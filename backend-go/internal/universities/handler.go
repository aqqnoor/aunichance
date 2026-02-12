package universities

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
)

type Handler struct {
	Repo Repo
}

func (h Handler) GetByID(c echo.Context) error {
	id := c.Param("id")
	u, err := h.Repo.GetByID(c.Request().Context(), id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	if u == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "university not found"})
	}
	return c.JSON(http.StatusOK, u)
}

func (h *Handler) List(c echo.Context) error {
	// Получаем параметры пагинации
	page, _ := strconv.Atoi(c.QueryParam("page"))
	limit, _ := strconv.Atoi(c.QueryParam("limit"))

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 50
	}
	offset := (page - 1) * limit

	// Получаем данные из БД
	universities, total, err := h.Repo.List(c.Request().Context(), limit, offset)
	if err != nil {
		return c.JSON(500, map[string]string{"error": err.Error()})
	}

	return c.JSON(200, map[string]interface{}{
		"data":  universities,
		"page":  page,
		"limit": limit,
		"total": total,
	})
}

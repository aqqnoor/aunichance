package scoring

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

type ChanceRequest struct {
	UserGPA       float64 `json:"user_gpa"`
	UserIELTS     float64 `json:"user_ielts"`
	RequiredGPA   float64 `json:"required_gpa"`
	RequiredIELTS float64 `json:"required_ielts"`
}

func CalculateChanceHandler(c echo.Context) error {
	var req ChanceRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "invalid request body",
		})
	}

	result := CalculateChance(
		req.UserGPA,
		req.UserIELTS,
		req.RequiredGPA,
		req.RequiredIELTS,
	)

	return c.JSON(http.StatusOK, result)
}

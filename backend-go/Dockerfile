# backend-go/Dockerfile
FROM golang:1.22-alpine AS build
WORKDIR /src

RUN apk add --no-cache ca-certificates git

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# API
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/api ./cmd/api
# ETL (College Scorecard)
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/import_scorecard ./cmd/import_scorecard

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=build /out/api /usr/local/bin/api
COPY --from=build /out/import_scorecard /usr/local/bin/import_scorecard

EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/api"]

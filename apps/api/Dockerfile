FROM golang:1.26-alpine AS build

WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o /out/rust-control-api ./cmd/api

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/rust-control-api /rust-control-api
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/rust-control-api"]

# Build stage: pure-Go binary (modernc.org/sqlite — no CGO needed).
FROM golang:1.26-alpine AS build
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -trimpath -o /out/pawly ./cmd/pawly

# Runtime stage: distroless static image with a non-root user.
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/pawly /usr/local/bin/pawly

ENV PAWLY_DATA_DIR=/data
EXPOSE 8080
VOLUME /data

ENTRYPOINT ["/usr/local/bin/pawly"]

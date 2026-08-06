# JavaChat

A real-time chat application built with an Angular frontend and Java Spring Boot microservices.

Available at: [java-chat-zeta.vercel.app](https://java-chat-zeta.vercel.app/)

## Tech Stack

- **Frontend:** Angular (v21) + Angular Material, served from Vercel
- **Backend:** Three Spring Boot (Java 17) microservices deployed on Render
  - `api-gateway` - Spring Cloud Gateway (routes, CORS, WebSocket proxying)
  - `auth-service` - registration, login, JWT issuance, user search
  - `chat-service` - message persistence, STOMP/WebSocket messaging, presence
- **Database:** MongoDB (Atlas in production, Docker for local)
- **Messaging:** WebSocket (STOMP). Kafka is scaffolded but disabled (see Limitations).

## Features

- User registration and login with JWT authentication
- Search for other users and add them as contacts
- One-to-one real-time chat over STOMP/WebSocket without delay
- Message history persists because it is stored in a database
- Presence indicators (green/grey dot) showing who is currently connected
- Responsive layout with a mobile friendly design

## Architecture

```
+------------+     +----------------------+
|  Browser   | --> |     api-gateway      |
| (Angular)  |     |  (Spring Cloud GW)   |
+------------+     +----------+-----------+
                              |
        +---------------------+--------+
        | /api/auth/**, /api/users/**  | /api/messages/**, /ws/**
        v                              v
+------------------+            +------------------+
|   auth-service   |            |   chat-service   |
|  (users, JWT)    |            | (messages, STOMP) |
+------------------+            +------------------+
        |                              |
        v                              v
   [ authdb ]                     [ chatdb ]
   (MongoDB)                     (MongoDB)
```

Each service has its own MongoDB database (`authdb`, `chatdb`). All client web traffic flows through the single gateway, which also proxies WebSocket upgrades for STOMP.

## Repository layout

```
.
├── api-gateway/         # Spring Cloud Gateway (routes, CORS, retry filter)
├── auth-service/        # Users, JWT, auth + user-search REST API
├── chat-service/        # Messages + STOMP/WebSocket + presence
├── chat-ui/             # Angular frontend
└── docker-compose.yml   # Local Mongo (+ optional Kafka/Zookeeper)
```

## Local setup

### Prerequisites

- Java 17+
- Maven (or use the included `./mvnw` wrapper)
- Node.js 18+ and npm
- Docker (optional, for local MongoDB via `docker-compose`)
- A MongoDB instance (local or Atlas) with two databases: `authdb` and `chatdb`

### 1. Start MongoDB

```bash
docker-compose up mongodb
```

### 2. Run the backend services

Each service is an independent Spring Boot app. Run them in three terminals.

Terminal 1 — gateway (port 8080)

```bash
cd api-gateway
./mvnw spring-boot:run
```

Terminal 2 — auth-service (port 8081)

```bash
cd auth-service
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

Terminal 3 — chat-service (port 8082)

```bash
cd chat-service
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

### 3. Run the frontend

```bash
cd chat-ui
npm install
npm start          # serves on http://localhost:4200
```

## API overview

All client requests go through the gateway (`http://localhost:8080`).

##### auth-service

| Method | Path                              | Auth   | Description                         |
| ------ | --------------------------------- | ------ | ----------------------------------- |
| GET    | `/api/auth/health`                | –      | Health check                        |
| POST   | `/api/auth/register`              | –      | Create an account, issues a JWT     |
| POST   | `/api/auth/login`                 | –      | Log in, issues a JWT                |
| GET    | `/api/auth/users/search?q=`       | JWT    | Search users by username            |
| GET    | `/api/auth/users/{username}/online` | JWT  | Read a user's presence flag         |

##### chat-service

| Method | Path                          | Auth | Description                                   |
|--------|-------------------------------|------|-----------------------------------------------|
| GET    | `/api/messages/health`        | –    | Health check (used for cold-start warm-up)    |
| GET    | `/api/messages/online`        | –    | Set of currently-connected usernames (presence) |
| GET    | `/api/messages/{otherUser}`   | JWT  | Chat history between the caller and a user    |
| WS     | `/ws` (STOMP)                 | JWT  | Realtime one-to-one messaging + presence  |

## Limitations

- **Cold start.** Render's free tier spins services down after ~15 minutes of idleness. The frontend automatically wakes the services on page load and shows a progress indicator, however it can take about 1-2 minutes to warm up.
- **Contacts are stored in local storage.** A users contacts aren't saved to a database and so disappear on a new device.
- **Kafka is not wired up.** I couldn't find a free way to deploy kafka. The dependency is present and a `docker-compose` broker is provided, but message/presence events are not published to Kafka. Kafka auto-configuration is excluded in `auth-service`, and presence is handled in-memory by `chat-service`.

## License

[MIT](LICENSE)

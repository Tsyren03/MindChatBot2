# MindChatBot2

# MindChatBot2

A simple, modular chatbot project with a Java backend (Gradle or Maven) and optional web frontend.

> **License:** MIT

---

## Quickstart

### Prerequisites

* Java 21+ (Temurin recommended)
* Node.js 20+ (only if you add/use a frontend)
* Docker (optional)

### Clone

```bash
git clone https://github.com/Tsyren03/MindChatBot2.git
cd MindChatBot2
```

### Backend

Choose the command that matches your build tool.

**Gradle**

```bash
cd backend
./gradlew clean test
# If Spring Boot
./gradlew bootRun
# Otherwise (plain Java app with application entrypoint)
./gradlew run
```

**Maven**

```bash
cd backend
mvn -B -ntp clean test
# If Spring Boot
mvn spring-boot:run
```

**Run packaged jar (both tools)**

```bash
# After building, an executable jar should be in build/libs or target
java -jar build/libs/app.jar   # Gradle
java -jar target/app.jar       # Maven
```

### Frontend (optional)

If/when you add a frontend:

```bash
cd frontend
npm ci
npm run dev
```

### Docker (optional)

```bash
docker compose up --build
```

---

## Configuration

Create an `.env` file in each service directory (e.g., `backend/.env`). Example:

```env
PORT=8080
LOG_LEVEL=info
OPENAI_API_KEY=your_key_here
```

> Never commit real secrets. Keep `.env*` ignored (see `.gitignore`).

---

## Project Structure

Recommended layout (current + suggested):

```
MindChatBot2/
├─ backend/                     # Java backend
│  ├─ src/
│  │  ├─ main/java/...          # Application sources
│  │  ├─ main/resources/        # app config (application.yml, etc.)
│  │  └─ test/java/...          # Unit tests
│  ├─ build.gradle(.kts) or pom.xml
│  └─ .env                      # local env vars (ignored)
├─ docs/
│  └─ images/                   # README images (e.g., Screenshot.jpeg)
├─ .github/workflows/           # CI workflows
├─ .gitignore
├─ .gitattributes
├─ LICENSE
└─ README.md
```

---
---

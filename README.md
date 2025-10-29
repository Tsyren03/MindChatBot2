🧠 MindChatBot: AI-Powered Mental Wellness Assistant
MindChatBot is a secure, full-stack web application designed to be an AI-powered companion for mental wellness. It provides users with a private and supportive space to chat, log their daily journals, and track their moods, all enhanced with intelligent, empathetic responses from an AI.

The backend is built with Spring Boot 3 and Spring Security, using JWT for stateless authentication and MongoDB for data persistence.

✨ Features
🤖 AI Conversational Agent: A core chat feature allowing users to talk with an AI, powered by the OpenAI API.

🔒 Secure Authentication: A robust security system using Spring Security 6, handling user registration, login, and password reset.

🔐 JSON Web Token (JWT): Stateless, secure API authentication for both web and potential mobile clients.

📓 Daily Journaling: A dedicated feature for users to write journal entries. The application provides an AI-generated supportive reply for each entry.

😊 Daily Mood Tracking: Users can log their daily mood (e.g., emoji, sub-mood) and receive an encouraging AI-powered response.

📈 Mood Statistics: An API endpoint to provide statistics and insights based on the user's logged mood history.

🌐 Internationalization (i18n): The application is configured to support multiple languages (EN, KO, RU), detecting language from headers or URL parameters.

🛡️ CSRF Protection: Hybrid security setup with CSRF protection for web-based, stateful form logins and disabled CSRF for stateless API routes.

🗂️ Full-Stack Project: A complete project with a Java backend and a (JavaScript/HTML/CSS) frontend.

🛠️ Tech Stack
Backend
Java 21

Spring Boot 3

Spring Security 6: For authentication and authorization.

Spring Web / WebFlux: Using Mono for non-blocking calls to the OpenAI API.

Spring Data MongoDB: For database interactions.

jjwt (Java JWT): For creating and validating JSON Web Tokens.

Spring Boot Mail: For sending verification and password reset emails.

Frontend
HTML5

CSS3

JavaScript (for API calls)

Database
MongoDB: A NoSQL database used to store users, chat logs, journal entries, and moods.

External APIs
OpenAI API: Used to generate all intelligent and empathetic responses.

🚀 Getting Started
Prerequisites
Java 21+ (e.g., Amazon Corretto or Temurin)

MongoDB: A running instance (e.g., MongoDB Atlas or a local server).

OpenAI API Key: A valid API key from OpenAI.

1. Configuration
Before running the application, you must configure your environment variables. You can do this by creating an application.properties or application.yml file in src/main/resources.

Key Properties:

Properties

# MongoDB Connection String (e.g., from Atlas)
spring.data.mongodb.uri=mongodb+srv://<username>:<password>@<cluster-url>/mindChatBotDB?retryWrites=true&w=majority

# JWT Secret Key (must be a long, random string, 32+ bytes)
jwt.secret=your-super-strong-base64-encoded-secret-key

# OpenAI API Key
openai.api.key=sk-YourOpenAIApiKeyGoesHere

# Email Configuration (example for Gmail)
spring.mail.host=smtp.gmail.com
spring.mail.port=587
spring.mail.username=your-email@gmail.com
spring.mail.password=your-gmail-app-password
spring.mail.properties.mail.smtp.auth=true
spring.mail.properties.mail.smtp.starttls.enable=true
2. Building and Running
Clone the repository:

Bash

git clone https://github.com/Tsyren03/MindChatBot2.git
cd MindChatBot2
Build and run using Gradle (recommended):

Bash

# On Windows
./gradlew.bat bootRun

# On macOS/Linux
./gradlew bootRun
Build and run using Maven:

Bash

mvn spring-boot:run
The application will start on http://localhost:8080 (or as configured).

🔐 Security Configuration
This project features a hybrid security model to protect both the user-facing web pages and the public API.

API Chain (/api/**):

Stateless: No sessions are created (SessionCreationPolicy.STATELESS).

JWT: Authenticated using the JwtAuthenticationFilter.

CSRF: Disabled.

CORS: Enabled.

Web Chain (/**):

Stateful: Uses standard sessions (SessionCreationPolicy.IF_REQUIRED).

Form Login: Redirects to /login for authentication.

CSRF: Enabled with a CookieCsrfTokenRepository (accessible to JavaScript) to protect against cross-site request forgery.

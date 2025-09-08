# MindChatBot

MindChatBot is a mental health support chatbot application designed to assist users with emotional tracking, journaling, and conversational support. The chatbot is powered by OpenAI's GPT model, integrated into a Spring Boot backend, with data stored in MongoDB. This application provides a conversational AI interface that helps users with emotional tracking, mental well-being, and journaling while saving the interaction history for improved context in subsequent chats.

[06/13 최종발표]
- 채팅이 나의 감정 기반으로 진행되도록 함. (현재는 다시 How about you? 같은 질문을 함)
- 전체적으로 깔끔하게 디자인하기 (그라데이션 없애기, 너무 강한 색상 사용하지 않기)
- 데모용 일기 텍스트 준비하기

- 학생들 조언: 통계 처리, 미래 일기 쓰기 막기, ChatBot에 날짜별로 기록? (날짜바를 넣는 것은 어떨까?), 감정색을 단순화하기, 날짜 숫자 색상 반전, 감정이 여러개? 중립적? 하루에 여러가지 감정 가능 (-> 날짜 기준이 아닌 일기 기준?) 마인드챗봇이 하루만 아니라 전날의 내용 반영, 여러 감정은 막대바로 표현
- 
## Features
- **Mood calendar**: Provides emotional tracking.
- **Journaling**: Users can write journal entries with timestamps.
- **Chat History**: All user interactions with the chatbot are saved to maintain context.
- **Personalized Conversations**: By storing and using previous interactions, the chatbot can provide more relevant responses based on past chats.
- **User Authentication**: Users can securely log in to track their progress and interactions.

## Tech Stack
- **Backend**: Spring Boot (Java)
- **Database**: MongoDB
- **AI**: OpenAI GPT-4 for conversational AI
- **Frontend**: (You may add details about your frontend stack if applicable)
- **Security**: Spring Security for user authentication
- **Reactive Programming**: Spring WebFlux (Reactor) for handling asynchronous interactions

## Getting Started

Follow these steps to set up and run the application locally:

### Prerequisites

Make sure you have the following installed:
- JDK 17 or later
- MongoDB (you can use MongoDB Atlas for a cloud instance or install it locally)
- Maven or Gradle (depending on your setup)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/MindChatBot.git
   cd MindChatBot

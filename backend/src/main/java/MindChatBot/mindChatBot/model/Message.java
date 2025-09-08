package MindChatBot.mindChatBot.model;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class Message {
    private String role;  // "user" or "assistant"
    private String content;

    // Optional: No-argument constructor for MongoDB to use
    public Message() {
    }
}
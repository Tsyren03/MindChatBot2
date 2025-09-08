package MindChatBot.mindChatBot.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "moods")
@Data
public class Mood {

    @Id
    private String id;  // MongoDB uses String for IDs by default
    private int year;
    private String userId;
    private int month;
    private int day;
    private String emoji;
    private String subMood;


    // Lombok will generate the getters, setters, toString, equals, and hashCode methods
}

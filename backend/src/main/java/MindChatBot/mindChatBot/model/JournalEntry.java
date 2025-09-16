// JournalEntry.java
package MindChatBot.mindChatBot.model;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Document(collection = "journal_entries")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class JournalEntry {
    @Id
    private String id;

    private String userId;
    private String content;

    // Expect "yyyy-MM-dd" in JSON
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    private LocalDate date;

    // Optional: nice ISO output for timestamp
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    private LocalDateTime timestamp;
}

package MindChatBot.mindChatBot.model;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "journal_entries")
public class JournalEntry {
    @Id
    private String id;
    private String userId;
    private String content;
    private LocalDateTime timestamp;
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate date;
}

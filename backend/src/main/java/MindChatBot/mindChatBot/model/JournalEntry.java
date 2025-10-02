package MindChatBot.mindChatBot.model;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Document(collection = "journal_entries")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@CompoundIndexes({
        // Speeds up queries: by date and by recent list
        @CompoundIndex(name = "idx_user_date", def = "{ 'userId': 1, 'date': 1 }"),
        @CompoundIndex(name = "idx_user_ts_desc", def = "{ 'userId': 1, 'timestamp': -1 }")
})
public class JournalEntry {
    @Id
    private String id;

    @Indexed
    private String userId;

    private String content;

    // Expect "yyyy-MM-dd" in JSON
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    private LocalDate date;

    // Optional: nice ISO output for timestamp
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    private LocalDateTime timestamp;
}

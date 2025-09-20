// File: src/main/java/MindChatBot/mindChatBot/model/Mood.java
package MindChatBot.mindChatBot.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "moods")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@CompoundIndexes({
        // Make one record per (user, date)
        @CompoundIndex(name = "uniq_user_day",
                def = "{ 'userId': 1, 'year': 1, 'month': 1, 'day': 1 }",
                unique = true)
})
public class Mood {

    @Id
    private String id;

    @Indexed
    private String userId;

    private int year;     // e.g., 2025
    private int month;    // 1..12
    private int day;      // 1..31

    /** Main mood code (keep English codes): bad|poor|neutral|good|best */
    private String emoji;

    /** Submood code (English): angry|sad|lonely|anxious|hopeless|... */
    private String subMood;

    /** UI language when saved (stored for auditing/analytics). Values: en|ko|ru */
    private String lang;

    /** Normalize lang to en|ko|ru (helper, optional to use). */
    public String getLangOrDefault() {
        String l = (lang == null ? "en" : lang).toLowerCase();
        if (l.startsWith("ko")) return "ko";
        if (l.startsWith("ru")) return "ru";
        return "en";
    }
}


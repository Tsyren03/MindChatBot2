package MindChatBot.mindChatBot.service;

import MindChatBot.mindChatBot.model.Mood;
import MindChatBot.mindChatBot.repository.MoodRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class MoodServiceTest {
    @Mock
    private MoodRepository moodRepository;

    @InjectMocks
    private MoodService moodService;

    @BeforeEach
    public void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    public void saveMood_validMood_savesSuccessfully() {
        Mood mood = new Mood();
        mood.setYear(2025);
        mood.setMonth(5);
        mood.setDay(28);
        mood.setEmoji("best");
        mood.setSubMood("proud");
        String userId = "user1";

        when(moodRepository.findByUserIdAndYearAndMonthAndDay(userId, 2025, 5, 28)).thenReturn(null);
        when(moodRepository.save(any(Mood.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Mood saved = moodService.saveMood(userId, mood);
        assertEquals("best", saved.getEmoji());
        assertEquals("proud", saved.getSubMood());
        assertEquals(userId, saved.getUserId());
    }

    @Test
    public void saveMood_invalidSubMood_throwsException() {
        Mood mood = new Mood();
        mood.setYear(2025);
        mood.setMonth(5);
        mood.setDay(28);
        mood.setEmoji("best");
        mood.setSubMood("angry"); // invalid for 'best'
        String userId = "user1";

        Exception ex = assertThrows(IllegalArgumentException.class, () -> {
            moodService.saveMood(userId, mood);
        });
        assertTrue(ex.getMessage().contains("Invalid subMood"));
    }

    @Test
    public void getMoodStatistics_returnsCorrectStats() {
        String userId = "user1";
        List<Mood> moods = Arrays.asList(
                createMood(userId, 2025, 5, 1, "best", "proud"),
                createMood(userId, 2025, 5, 2, "best", "grateful"),
                createMood(userId, 2025, 5, 3, "good", "calm"),
                createMood(userId, 2025, 5, 4, "bad", "sad"),
                createMood(userId, 2025, 5, 5, "bad", "angry")
        );
        when(moodRepository.findByUserId(userId)).thenReturn(moods);

        Map<String, Object> stats = moodService.getMoodStatistics(userId);
        Map<String, Double> mainStats = (Map<String, Double>) stats.get("mainMoodStats");
        Map<String, Double> subStats = (Map<String, Double>) stats.get("subMoodStats");

        assertEquals(2 * 100.0 / 5, mainStats.get("best"));
        assertEquals(1 * 100.0 / 5, mainStats.get("good"));
        assertEquals(0.0, mainStats.get("neutral"));
        assertEquals(0.0, mainStats.get("poor"));
        assertEquals(2 * 100.0 / 5, mainStats.get("bad"));

        assertEquals(1 * 100.0 / 5, subStats.get("best:proud"));
        assertEquals(1 * 100.0 / 5, subStats.get("best:grateful"));
        assertEquals(1 * 100.0 / 5, subStats.get("good:calm"));
        assertEquals(1 * 100.0 / 5, subStats.get("bad:sad"));
        assertEquals(1 * 100.0 / 5, subStats.get("bad:angry"));
    }

    private Mood createMood(String userId, int year, int month, int day, String emoji, String subMood) {
        Mood m = new Mood();
        m.setUserId(userId);
        m.setYear(year);
        m.setMonth(month);
        m.setDay(day);
        m.setEmoji(emoji);
        m.setSubMood(subMood);
        return m;
    }
}


package MindChatBot.mindChatBot.repository;

import MindChatBot.mindChatBot.model.Mood;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface MoodRepository extends MongoRepository<Mood, String> {

    List<Mood> findByUserIdAndYearAndMonth(String userId, int year, int month);

    Mood findByUserIdAndYearAndMonthAndDay(String userId, int year, int month, int day);

    List<Mood> findByUserId(String userId); // Added to match your usage
}
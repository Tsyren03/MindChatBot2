package MindChatBot.mindChatBot.util;

import org.springframework.context.i18n.LocaleContextHolder;

import java.util.Locale;

public final class LangUtils {
    private LangUtils(){}

    public static String normalize(String langMaybeNull) {
        if (langMaybeNull == null || langMaybeNull.isBlank()) {
            langMaybeNull = LocaleContextHolder.getLocale().getLanguage();
        }
        String p = langMaybeNull.toLowerCase();
        if (p.startsWith("ko")) return "ko";
        if (p.startsWith("ru")) return "ru";
        return "en";
    }

    public static Locale toLocale(String code) {
        return switch (normalize(code)) {
            case "ko" -> Locale.KOREAN;
            case "ru" -> new Locale("ru");
            default -> Locale.ENGLISH;
        };
    }
}

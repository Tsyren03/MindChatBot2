package MindChatBot.mindChatBot.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.Nullable;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.LocaleResolver;

import java.util.Locale;

/**
 * If no ?lang= param is present, use the Accept-Language header to set the request Locale.
 * Works alongside LocaleChangeInterceptor (which looks at ?lang=).
 */
public class HeaderLocaleInterceptor implements HandlerInterceptor {

    private final LocaleResolver localeResolver;

    public HeaderLocaleInterceptor(LocaleResolver localeResolver) {
        this.localeResolver = localeResolver;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        // If ?lang= is present, LocaleChangeInterceptor will handle it.
        if (StringUtils.hasText(request.getParameter("lang"))) return true;

        String header = request.getHeader("Accept-Language");
        Locale locale = resolveFromHeader(header);
        if (locale != null) {
            localeResolver.setLocale(request, response, locale);
        }
        return true;
    }

    @Nullable
    private Locale resolveFromHeader(@Nullable String header) {
        if (!StringUtils.hasText(header)) return null;
        // Very small normalizer: only keep primary tag
        String tag = header.split(",")[0].trim(); // e.g. "ko-KR" or "ru"
        if (!StringUtils.hasText(tag)) return null;
        String primary = tag.split("-|_")[0].toLowerCase();
        return switch (primary) {
            case "ko" -> Locale.KOREAN;
            case "ru" -> new Locale("ru");
            default -> Locale.ENGLISH;
        };
    }
}

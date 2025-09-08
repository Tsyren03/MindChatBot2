// File: MindChatBot/mindChatBot/config/JwtTokenProvider.java
package MindChatBot.mindChatBot.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.JwtParser;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.io.DecodingException;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Component
public class JwtTokenProvider {

    @Value("${jwt.secret}")
    private String secretKeyValue;

    private Key key;
    private JwtParser parser;

    @PostConstruct
    void init() {
        byte[] keyBytes = decodeSecret(secretKeyValue);

        // Enforce 256-bit minimum for HS256
        if (keyBytes.length < 32) {
            throw new IllegalArgumentException(
                    "jwt.secret is too short; need at least 32 bytes (256 bits). " +
                            "Provide a longer secret or a Base64/Base64URL-encoded value."
            );
        }

        this.key = Keys.hmacShaKeyFor(keyBytes);
        this.parser = Jwts.parserBuilder()
                .setSigningKey(this.key)
                .setAllowedClockSkewSeconds(60) // tolerate small clock drift
                .build();
    }

    private static byte[] decodeSecret(String value) {
        String s = (value == null) ? "" : value.trim();

        // 1) Try Base64URL (accepts '-' and '_')
        try { return Decoders.BASE64URL.decode(s); }
        catch (DecodingException ignore) { /* fall through */ }

        // 2) Try standard Base64
        try { return Decoders.BASE64.decode(s); }
        catch (DecodingException ignore) { /* fall through */ }

        // 3) Treat as plain text (UTF-8 bytes)
        return s.getBytes(StandardCharsets.UTF_8);
    }

    public Claims parseClaims(String token) throws JwtException {
        // validates signature & exp/nbf automatically
        return parser.parseClaimsJws(token).getBody();
    }

    public boolean validateToken(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public Authentication getAuthentication(String token) {
        Claims claims = parseClaims(token);
        String email = claims.getSubject();
        List<SimpleGrantedAuthority> roles = getAuthoritiesFromClaims(claims);
        return new UsernamePasswordAuthenticationToken(email, null, roles);
    }

    @SuppressWarnings("unchecked")
    private List<SimpleGrantedAuthority> getAuthoritiesFromClaims(Claims claims) {
        Object raw = claims.get("roles");
        if (raw == null) return List.of(new SimpleGrantedAuthority("ROLE_USER"));

        if (raw instanceof String s) {
            return Arrays.stream(s.split(","))
                    .map(String::trim).filter(r -> !r.isEmpty())
                    .map(this::ensureRolePrefix)
                    .map(SimpleGrantedAuthority::new)
                    .collect(Collectors.toList());
        }

        if (raw instanceof List<?> list) {
            return list.stream()
                    .map(String::valueOf)
                    .map(String::trim).filter(r -> !r.isEmpty())
                    .map(this::ensureRolePrefix)
                    .map(SimpleGrantedAuthority::new)
                    .collect(Collectors.toList());
        }

        return List.of(new SimpleGrantedAuthority("ROLE_USER"));
    }

    private String ensureRolePrefix(String role) {
        return role.startsWith("ROLE_") ? role : "ROLE_" + role;
    }
}

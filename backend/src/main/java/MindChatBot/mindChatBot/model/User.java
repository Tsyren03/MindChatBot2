package MindChatBot.mindChatBot.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Document(collection = "users")
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Setter
@Getter
@ToString
public class User implements UserDetails {

    @Id
    @Builder.Default
    private String id = UUID.randomUUID().toString();

    private String name;

    @Deprecated
    private String username;

    @Indexed(unique = true)
    private String email;

    @JsonIgnore
    @ToString.Exclude
    private String password;

    @Builder.Default
    private List<String> roles = List.of("USER");

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    // --- Email verification / 2FA registration state ---
    @JsonIgnore
    @ToString.Exclude
    private String verificationCode;

    private LocalDateTime verificationCodeExpiresAt;

    private LocalDateTime lastVerificationCodeSentAt;

    @Builder.Default
    private int verificationAttemptCount = 0;

    private LocalDateTime verificationLockedUntil;

    @Builder.Default
    private boolean isVerified = false;
    // --- end verification state ---

    public String getNameSafe() {
        return (name != null && !name.isBlank())
                ? name
                : (username != null ? username : "");
    }

    /* ---------- Spring Security ---------- */

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        List<String> rs = (roles == null) ? List.of() : roles;
        return rs.stream()
                .map(r -> r == null ? "" : r.trim())
                .filter(r -> !r.isEmpty())
                .map(r -> r.startsWith("ROLE_") ? r : "ROLE_" + r)
                .map(SimpleGrantedAuthority::new)
                .collect(Collectors.toList());
    }

    @Override public String getPassword() { return password; }

    @Override public String getUsername() { return email; }

    @Override public boolean isAccountNonExpired()     { return true; }
    @Override public boolean isAccountNonLocked()      { return true; }
    @Override public boolean isCredentialsNonExpired() { return true; }

    @Override
    public boolean isEnabled() {
        return this.isVerified;
    }

    /* ---------- Helpers for verification lifecycle ---------- */

    public void clearVerificationState() {
        this.verificationCode = null;
        this.verificationCodeExpiresAt = null;
        this.lastVerificationCodeSentAt = null;
        this.verificationAttemptCount = 0;
        this.verificationLockedUntil = null;
    }

    public void markVerified() {
        this.isVerified = true;
        clearVerificationState();
    }
}

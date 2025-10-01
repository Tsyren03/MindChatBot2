package MindChatBot.mindChatBot.model;

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
public class User implements UserDetails {

    @Id
    @Builder.Default
    private String id = UUID.randomUUID().toString();

    /** Human display name (NEW). */
    private String name;

    /** Kept for backward compatibility with older documents that used "username" as name. */
    @Deprecated
    private String username;

    @Indexed(unique = true)
    private String email;

    private String password;

    @Builder.Default
    private List<String> roles = List.of("USER");

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    /** Prefer the new "name" field; fall back to legacy "username" if present. */
    public String getNameSafe() {
        return (name != null && !name.isBlank())
                ? name
                : (username != null ? username : "");
    }

    /* ---------- Spring Security ---------- */

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return roles.stream()
                .map(r -> r == null ? "" : r.trim())
                .filter(r -> !r.isEmpty())
                .map(r -> r.startsWith("ROLE_") ? r : "ROLE_" + r)
                .map(SimpleGrantedAuthority::new)
                .collect(Collectors.toList());
    }

    @Override
    public String getPassword() { return password; }

    /** Use email as the login username. */
    @Override
    public String getUsername() { return email; }

    @Override public boolean isAccountNonExpired()     { return true; }
    @Override public boolean isAccountNonLocked()      { return true; }
    @Override public boolean isCredentialsNonExpired() { return true; }
    @Override public boolean isEnabled()               { return true; }
}

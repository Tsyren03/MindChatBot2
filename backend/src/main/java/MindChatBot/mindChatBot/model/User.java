package MindChatBot.mindChatBot.model;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Document(collection = "users")
@NoArgsConstructor
@Builder
@Setter
@Getter
@AllArgsConstructor
public class User implements UserDetails {

    @Id
    @Builder.Default
    private String id = UUID.randomUUID().toString();

    private String username;

    @Indexed(unique = true)
    private String email;

    private String password;

    // 기본값으로 빈 리스트를 설정
    @Builder.Default
    private List<String> roles = List.of("USER");  // 기본 역할을 USER로 설정

    // 가입일 반환 (createdAt 필드가 없으면 null)
    private java.time.LocalDateTime createdAt;
    public java.time.LocalDateTime getCreatedAt() {
        return createdAt;
    }

    // 이름 반환 (username 필드가 name 역할)
    public String getName() {
        return username;
    }
    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return roles.stream()
                .map(r -> r == null ? "" : r.trim())
                .filter(r -> !r.isEmpty())
                .map(r -> r.startsWith("ROLE_") ? r : "ROLE_" + r) // add prefix only if missing
                .map(SimpleGrantedAuthority::new)
                .collect(Collectors.toList());
    }


    @Override
    public String getPassword() {
        return password;
    }

    @Override
    public String getUsername() {
        return email;  // email을 username처럼 사용
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }
}

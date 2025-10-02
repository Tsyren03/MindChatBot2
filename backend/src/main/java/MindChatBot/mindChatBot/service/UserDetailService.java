package MindChatBot.mindChatBot.service;

import MindChatBot.mindChatBot.model.User;
import MindChatBot.mindChatBot.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserDetailService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User u = userRepository.findByEmail(email.toLowerCase().trim())
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));

        // Use authorities derived from stored roles (USER/ADMIN…).
        // Login is allowed only for verified users.
        return new org.springframework.security.core.userdetails.User(
                u.getEmail(),
                u.getPassword(),
                u.isVerified(),  // enabled if verified
                true,
                true,
                true,
                u.getAuthorities() // from User model (ROLE_* mapping inside)
        );
    }
}

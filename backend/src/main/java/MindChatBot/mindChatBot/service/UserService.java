package MindChatBot.mindChatBot.service;

import MindChatBot.mindChatBot.dto.AddUserRequest;
import MindChatBot.mindChatBot.model.User;
import MindChatBot.mindChatBot.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    public String save(AddUserRequest dto) {
        // 이메일이 이미 존재하는지 확인
        if (userRepository.findByEmail(dto.getEmail()).isPresent()) {
            throw new IllegalStateException("Email is already in use");
        }

        // 사용자 객체 생성 및 저장
        User user = User.builder()
                .email(dto.getEmail())  // 'request' 대신 'dto' 사용
                .password(passwordEncoder.encode(dto.getPassword()))  // 패스워드 암호화
                .roles(List.of("USER"))  // 기본 역할 부여
                .build();

        // 사용자 저장
        userRepository.save(user);

        return user.getId();  // 반환 값 수정
    }

    // 이메일로 사용자 조회
    public Optional<User> findByEmail(String email) {
        return userRepository.findByEmail(email);
    }

    // 사용자 저장
    public User saveUser(User user) {
        return userRepository.save(user);
    }

    // 사용자 삭제
    public void deleteUser(String id) {
        userRepository.deleteById(id);
    }
}

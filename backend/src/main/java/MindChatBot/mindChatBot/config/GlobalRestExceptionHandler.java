// GlobalRestExceptionHandler.java
package MindChatBot.mindChatBot.config;

import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestControllerAdvice
public class GlobalRestExceptionHandler {
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String,Object>> badRequest(IllegalArgumentException e){
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error","bad_request","message",e.getMessage()));
    }
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String,Object>> serverErr(Exception e){
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error","server_error","message",e.getMessage()));
    }
}

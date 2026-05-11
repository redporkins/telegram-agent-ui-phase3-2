package com.oraclebot.phase3.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.oraclebot.phase3.config.AiProps;
import java.net.URI;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class LlmIntentParser implements IntentParser {

    private static final Logger logger = LoggerFactory.getLogger(LlmIntentParser.class);

    private final AiProps aiProps;
    private final ObjectMapper objectMapper;
    private final RuleBasedIntentParser fallbackParser;

    public LlmIntentParser(AiProps aiProps, ObjectMapper objectMapper, RuleBasedIntentParser fallbackParser) {
        this.aiProps = aiProps;
        this.objectMapper = objectMapper;
        this.fallbackParser = fallbackParser;
    }

    @Override
    public ParsedIntent parse(String messageText) {
        if (!aiProps.isEnabled() || aiProps.getApiKey() == null || aiProps.getApiKey().isBlank()) {
            return fallbackParser.parse(messageText);
        }

        try {
            // Build full Gemini URL: {baseUrl}/models/{model}:generateContent
            String geminiUrl = aiProps.getBaseUrl()
                + "/models/" + aiProps.getModel() + ":generateContent";

            RestClient client = RestClient.builder()
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader("x-goog-api-key", aiProps.getApiKey())
                .build();

            String systemPrompt = """
                Eres un clasificador de intenciones para un asistente de gestion agile.
                Debes responder solo JSON valido sin bloques de codigo ni texto adicional.
                Intenciones permitidas:
                HELP
                LIST_TASKS
                LIST_TASKS_BY_ASSIGNEE
                LIST_TASKS_BY_STATUS
                CREATE_TASK
                CURRENT_SPRINT_SUMMARY
                TEAM_LOAD_SUMMARY
                UNKNOWN

                Devuelve JSON con los campos:
                intent, assignee, status, title, storyPoints, sprintName, clarificationNeeded, clarificationQuestion.
                Si falta informacion importante, pon clarificationNeeded en true y escribe la pregunta.
                """;

            // Gemini request format: contents with parts
            Map<String, Object> payload = Map.of(
                "contents", List.of(
                    Map.of("parts", List.of(
                        Map.of("text", systemPrompt + "\n\nMensaje del usuario: " + messageText)
                    ))
                ),
                "generationConfig", Map.of("temperature", 0)
            );

            String responseBody = client.post()
                .uri(URI.create(geminiUrl))
                .body(payload)
                .retrieve()
                .body(String.class);

            // Gemini response: candidates[0].content.parts[0].text
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode text = root.path("candidates").path(0).path("content").path("parts").path(0).path("text");
            if (text.isMissingNode() || text.asText().isBlank()) {
                return fallbackParser.parse(messageText);
            }

            // Strip possible markdown code fences if Gemini wraps JSON
            String raw = text.asText().trim()
                .replaceAll("(?s)^```json\\s*", "")
                .replaceAll("(?s)^```\\s*", "")
                .replaceAll("\\s*```$", "")
                .trim();

            return objectMapper.readValue(raw, ParsedIntent.class);
        } catch (Exception ex) {
            logger.warn("Fallo el parser LLM con Gemini. Uso fallback local.", ex);
            return fallbackParser.parse(messageText);
        }
    }
}


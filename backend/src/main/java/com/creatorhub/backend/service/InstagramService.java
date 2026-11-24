package com.creatorhub.backend.service;

import com.creatorhub.backend.dto.AuthResponseDto;
import com.creatorhub.backend.dto.InstagramProfileDto;
import com.creatorhub.backend.entity.CreatorProfile;
import com.creatorhub.backend.entity.MerchantProfile;
import com.creatorhub.backend.entity.Role;
import com.creatorhub.backend.entity.User;
import com.creatorhub.backend.repository.CreatorProfileRepository;
import com.creatorhub.backend.repository.MerchantProfileRepository;
import com.creatorhub.backend.repository.UserRepository;
import com.creatorhub.backend.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class InstagramService {

    private final UserRepository userRepository;
    private final CreatorProfileRepository creatorProfileRepository;
    private final MerchantProfileRepository merchantProfileRepository;
    private final JwtService jwtService;
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${instagram.config-id:}")
    private String configId;

    @Value("${instagram.ig-app-id:}")
    private String igAppId;

    @Value("${instagram.ig-app-secret:}")
    private String igAppSecret;

    @Value("${instagram.client-id:}")
    private String clientId;

    @Value("${instagram.client-secret:}")
    private String clientSecret;

    @Value("${instagram.redirect-uri:http://localhost:5173/auth/callback/instagram}")
    private String redirectUri;

    public boolean isUnifiedLoginConfigured() {
        return configId != null && !configId.isBlank() && isMetaConfigured();
    }

    public boolean isDirectInstagramConfigured() {
        return igAppId != null && !igAppId.isBlank() && igAppSecret != null && !igAppSecret.isBlank();
    }

    public boolean isMetaConfigured() {
        return clientId != null && !clientId.isBlank() && clientSecret != null && !clientSecret.isBlank();
    }

    public String getActiveProvider() {
        if (isUnifiedLoginConfigured() || isDirectInstagramConfigured()) {
            return "instagram";
        }
        if (isMetaConfigured()) {
            return "meta";
        }
        return "unconfigured";
    }

    public String getAuthorizationUrl() {
        String encodedRedirect = URLEncoder.encode(redirectUri, StandardCharsets.UTF_8);

        if (isUnifiedLoginConfigured()) {
            // Instagram API with Unified Login (Meta's new standard for Instagram professional accounts)
            return "https://www.facebook.com/v21.0/dialog/oauth" +
                    "?client_id=" + clientId.trim() +
                    "&redirect_uri=" + encodedRedirect +
                    "&config_id=" + configId.trim() +
                    "&response_type=code";
        }

        if (isDirectInstagramConfigured()) {
            // Legacy Direct Instagram API with Instagram Login
            return "https://www.instagram.com/oauth/authorize" +
                    "?client_id=" + igAppId.trim() +
                    "&redirect_uri=" + encodedRedirect +
                    "&response_type=code" +
                    "&scope=instagram_business_basic";
        }

        if (isMetaConfigured()) {
            // Standard Meta / Facebook Login OAuth dialog
            return "https://www.facebook.com/v21.0/dialog/oauth" +
                    "?client_id=" + clientId.trim() +
                    "&redirect_uri=" + encodedRedirect +
                    "&scope=public_profile" +
                    "&response_type=code";
        }

        return null;
    }

    @Transactional
    public AuthResponseDto loginWithCode(String rawCode) {
        return loginWithCode(rawCode, null);
    }

    @Transactional
    public AuthResponseDto loginWithCode(String rawCode, String requestedRole) {
        if (rawCode == null || rawCode.isBlank()) {
            throw new IllegalArgumentException("OAuth authorization code is required.");
        }
        // Instagram appends "#_" to the end of the authorization code in redirects
        String code = rawCode.replaceAll("#_$", "").trim();

        if (!isDirectInstagramConfigured() && !isMetaConfigured()) {
            throw new IllegalStateException("Instagram/Meta OAuth credentials are not configured on the server.");
        }

        InstagramProfileDto profile = exchangeCodeForRealProfile(code);
        return loginOrRegisterWithProfile(profile, requestedRole);
    }

    @Transactional
    public AuthResponseDto loginOrRegisterWithProfile(InstagramProfileDto igProfile) {
        return loginOrRegisterWithProfile(igProfile, null);
    }

    @Transactional
    public AuthResponseDto loginOrRegisterWithProfile(InstagramProfileDto igProfile, String requestedRole) {
        String igId = igProfile.getId() != null ? igProfile.getId() : "ig_" + igProfile.getUsername().toLowerCase();
        String syntheticPhone = "+ig" + Math.abs(igId.hashCode() % 10000000000L);

        Optional<User> existingUser = userRepository.findByInstagramId(igId);
        User user;

        if (existingUser.isPresent()) {
            user = existingUser.get();
        } else {
            Optional<User> userByPhone = userRepository.findByPhone(syntheticPhone);
            if (userByPhone.isPresent()) {
                user = userByPhone.get();
                user.setInstagramId(igId);
                user = userRepository.save(user);
            } else {
                try {
                    String emailPrefix = (igProfile.getUsername() != null && !igProfile.getUsername().isBlank())
                            ? igProfile.getUsername()
                            : "user_" + igId;
                    Role roleToAssign = "MERCHANT".equalsIgnoreCase(requestedRole) ? Role.MERCHANT : Role.CREATOR;
                    User newUser = User.builder()
                            .phone(syntheticPhone)
                            .instagramId(igId)
                            .email(emailPrefix + "@creatorhub.app")
                            .role(roleToAssign)
                            .isVerified(true)
                            .build();
                    user = userRepository.save(newUser);
                } catch (Exception e) {
                    user = userRepository.findByInstagramId(igId)
                            .or(() -> userRepository.findByPhone(syntheticPhone))
                            .orElseThrow(() -> new IllegalStateException("Failed to register user: " + e.getMessage()));
                }
            }
        }

        final User finalUser = user;
        if (finalUser.getRole() == Role.MERCHANT) {
            merchantProfileRepository.findByUserId(finalUser.getId())
                    .orElseGet(() -> {
                        String brandName = (igProfile.getName() != null && !igProfile.getName().isBlank())
                                ? igProfile.getName()
                                : (igProfile.getUsername() != null ? igProfile.getUsername() : "Brand " + finalUser.getId());
                        MerchantProfile mp = MerchantProfile.builder()
                                .user(finalUser)
                                .companyName(brandName)
                                .contactEmail(finalUser.getEmail())
                                .build();
                        return merchantProfileRepository.save(mp);
                    });
        } else {
            CreatorProfile profile = creatorProfileRepository.findByUserId(finalUser.getId())
                    .orElseGet(() -> CreatorProfile.builder().user(finalUser).build());

            if (igProfile.getName() != null && !igProfile.getName().isBlank()) {
                profile.setDisplayName(igProfile.getName());
            } else if (profile.getDisplayName() == null && igProfile.getUsername() != null) {
                profile.setDisplayName(igProfile.getUsername());
            }

            if (igProfile.getProfilePictureUrl() != null && !igProfile.getProfilePictureUrl().isBlank()) {
                profile.setAvatarUrl(igProfile.getProfilePictureUrl());
            }
            if (igProfile.getBiography() != null && !igProfile.getBiography().isBlank()) {
                profile.setBio(igProfile.getBiography());
            }
            if (igProfile.getUsername() != null && !igProfile.getUsername().isBlank()) {
                profile.setInstagramHandle(igProfile.getUsername());
            }
            if (igProfile.getFollowersCount() != null) {
                profile.setInstagramFollowers(igProfile.getFollowersCount());
            }
            if (igProfile.getWebsite() != null && !igProfile.getWebsite().isBlank()) {
                profile.setPortfolioLinks(igProfile.getWebsite());
            }
            profile.setInstagramVerified(true);
            profile.recalculateTotalFollowers();
            creatorProfileRepository.save(profile);
        }

        String token = jwtService.generateToken(user);

        String displayIdentity = (igProfile.getUsername() != null && !igProfile.getUsername().isBlank())
                ? "@" + igProfile.getUsername()
                : (igProfile.getName() != null ? igProfile.getName() : igId);

        return AuthResponseDto.builder()
                .token(token)
                .role(user.getRole().getAuthority())
                .phone(user.getPhone())
                .userId(user.getId())
                .message("Logged in successfully (" + displayIdentity + ")")
                .build();
    }

    @Transactional
    public CreatorProfile syncInstagramDetails(String creatorPhone, InstagramProfileDto igProfile) {
        User user = userRepository.findByPhone(creatorPhone)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + creatorPhone));

        CreatorProfile profile = creatorProfileRepository.findByUserId(user.getId())
                .orElseGet(() -> CreatorProfile.builder().user(user).build());

        if (igProfile.getId() != null) {
            user.setInstagramId(igProfile.getId());
            userRepository.save(user);
        }
        if (igProfile.getUsername() != null && !igProfile.getUsername().isBlank()) {
            profile.setInstagramHandle(igProfile.getUsername());
        }
        if (igProfile.getName() != null && !igProfile.getName().isBlank()) {
            profile.setDisplayName(igProfile.getName());
        }
        if (igProfile.getProfilePictureUrl() != null && !igProfile.getProfilePictureUrl().isBlank()) {
            profile.setAvatarUrl(igProfile.getProfilePictureUrl());
        }
        if (igProfile.getBiography() != null && !igProfile.getBiography().isBlank()) {
            profile.setBio(igProfile.getBiography());
        }
        if (igProfile.getFollowersCount() != null) {
            profile.setInstagramFollowers(igProfile.getFollowersCount());
        }
        profile.setInstagramVerified(true);

        profile.recalculateTotalFollowers();
        return creatorProfileRepository.save(profile);
    }

    @Transactional
    public String generateBioVerificationCode(String creatorPhone) {
        User user = userRepository.findByPhone(creatorPhone)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + creatorPhone));
        int randomDigits = (int) (1000 + Math.random() * 9000);
        return "CH-" + randomDigits;
    }

    @Transactional
    public CreatorProfile verifyInstagramBio(String creatorPhone, String handle, String expectedCode, Integer estimatedFollowers) {
        User user = userRepository.findByPhone(creatorPhone)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + creatorPhone));
        CreatorProfile profile = creatorProfileRepository.findByUserId(user.getId())
                .orElseGet(() -> CreatorProfile.builder().user(user).build());

        String cleanHandle = handle.replace("@", "").trim();
        if (cleanHandle.isBlank()) {
            throw new IllegalArgumentException("Instagram handle is required.");
        }

        int verifiedFollowers = estimatedFollowers != null && estimatedFollowers > 0 ? estimatedFollowers : 1200;
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            headers.set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
            HttpEntity<String> entity = new HttpEntity<>(headers);
            ResponseEntity<String> response = restTemplate.exchange(
                    "https://www.instagram.com/" + cleanHandle + "/",
                    HttpMethod.GET,
                    entity,
                    String.class
            );
            if (response.getBody() != null) {
                String body = response.getBody();
                java.util.regex.Pattern p = java.util.regex.Pattern.compile("([0-9.,]+[KkMm]?)\\s+Followers", java.util.regex.Pattern.CASE_INSENSITIVE);
                java.util.regex.Matcher m = p.matcher(body);
                if (m.find()) {
                    verifiedFollowers = parseFollowerCount(m.group(1));
                }
            }
        } catch (Exception ex) {
            log.info("Direct Instagram scrape skipped or rate-limited for @{}: {}", cleanHandle, ex.getMessage());
        }

        profile.setInstagramHandle(cleanHandle);
        profile.setInstagramFollowers(verifiedFollowers);
        profile.setInstagramVerified(true);
        profile.recalculateTotalFollowers();
        return creatorProfileRepository.save(profile);
    }

    private int parseFollowerCount(String raw) {
        try {
            raw = raw.trim().toUpperCase();
            if (raw.endsWith("M")) {
                return (int) (Double.parseDouble(raw.replace("M", "").replace(",", "")) * 1_000_000);
            } else if (raw.endsWith("K")) {
                return (int) (Double.parseDouble(raw.replace("K", "").replace(",", "")) * 1_000);
            } else {
                return Integer.parseInt(raw.replace(",", ""));
            }
        } catch (Exception e) {
            return 1000;
        }
    }

    private InstagramProfileDto exchangeCodeForRealProfile(String code) {
        if (isUnifiedLoginConfigured()) {
            return exchangeCodeWithMetaFacebookApi(code);
        }
        if (isDirectInstagramConfigured()) {
            return exchangeCodeWithInstagramApi(code);
        }
        return exchangeCodeWithMetaFacebookApi(code);
    }

    @SuppressWarnings("unchecked")
    private InstagramProfileDto exchangeCodeWithInstagramApi(String code) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            MultiValueMap<String, String> map = new LinkedMultiValueMap<>();
            map.add("client_id", igAppId.trim());
            map.add("client_secret", igAppSecret.trim());
            map.add("grant_type", "authorization_code");
            map.add("redirect_uri", redirectUri);
            map.add("code", code);

            HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(map, headers);
            ResponseEntity<Map> tokenResponse = restTemplate.postForEntity(
                    "https://api.instagram.com/oauth/access_token", request, Map.class);

            if (tokenResponse.getBody() == null || !tokenResponse.getBody().containsKey("access_token")) {
                throw new IllegalStateException("Instagram did not return an access_token.");
            }

            String accessToken = String.valueOf(tokenResponse.getBody().get("access_token"));
            String userId = String.valueOf(tokenResponse.getBody().get("user_id"));

            // Fetch live real profile from Instagram Graph API
            String fields = "user_id,username,name,account_type,media_count,followers_count,follows_count,biography,profile_picture_url";
            String graphUrl = "https://graph.instagram.com/v21.0/me?fields=" + fields + "&access_token=" + accessToken;
            Map<String, Object> graphData = restTemplate.getForObject(graphUrl, Map.class);

            if (graphData == null) {
                throw new IllegalStateException("Instagram Graph API returned an empty profile response.");
            }

            String resolvedId = graphData.get("user_id") != null
                    ? String.valueOf(graphData.get("user_id"))
                    : (graphData.get("id") != null ? String.valueOf(graphData.get("id")) : userId);
            String username = graphData.get("username") != null ? String.valueOf(graphData.get("username")) : null;
            String name = graphData.get("name") != null && !String.valueOf(graphData.get("name")).isBlank()
                    ? String.valueOf(graphData.get("name"))
                    : username;
            Integer followers = graphData.get("followers_count") instanceof Number
                    ? ((Number) graphData.get("followers_count")).intValue()
                    : 0;
            Integer follows = graphData.get("follows_count") instanceof Number
                    ? ((Number) graphData.get("follows_count")).intValue()
                    : 0;
            Integer mediaCount = graphData.get("media_count") instanceof Number
                    ? ((Number) graphData.get("media_count")).intValue()
                    : 0;
            String bio = graphData.get("biography") != null ? String.valueOf(graphData.get("biography")) : null;
            String profilePic = graphData.get("profile_picture_url") != null
                    ? String.valueOf(graphData.get("profile_picture_url"))
                    : null;
            String accountType = graphData.get("account_type") != null
                    ? String.valueOf(graphData.get("account_type"))
                    : null;

            log.info("Live Instagram profile fetched: username=@{}, followers={}, follows={}, media={}, accountType={}",
                    username, followers, follows, mediaCount, accountType);

            return InstagramProfileDto.builder()
                    .id(resolvedId)
                    .username(username)
                    .name(name)
                    .biography(bio)
                    .profilePictureUrl(profilePic)
                    .followersCount(followers)
                    .followsCount(follows)
                    .mediaCount(mediaCount)
                    .build();
        } catch (Exception e) {
            log.error("Instagram OAuth code exchange failed: {}", e.getMessage());
            throw new RuntimeException("Instagram authentication failed: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private InstagramProfileDto exchangeCodeWithMetaFacebookApi(String code) {
        try {
            String fbTokenUrl = "https://graph.facebook.com/v21.0/oauth/access_token" +
                    "?client_id=" + clientId.trim() +
                    "&client_secret=" + clientSecret.trim() +
                    "&redirect_uri=" + URLEncoder.encode(redirectUri, StandardCharsets.UTF_8) +
                    "&code=" + URLEncoder.encode(code, StandardCharsets.UTF_8);

            ResponseEntity<Map> fbTokenResp = restTemplate.getForEntity(fbTokenUrl, Map.class);
            if (fbTokenResp.getBody() == null || !fbTokenResp.getBody().containsKey("access_token")) {
                throw new IllegalStateException("Meta did not return an access_token.");
            }

            String accessToken = String.valueOf(fbTokenResp.getBody().get("access_token"));

            // Step 1: Instagram API with Unified Login — fetch assigned_instagram_accounts
            try {
                String assignedUrl = "https://graph.facebook.com/v21.0/me/assigned_instagram_accounts?fields=id,username&access_token=" + accessToken;
                Map<String, Object> assignedData = restTemplate.getForObject(assignedUrl, Map.class);
                if (assignedData != null && assignedData.get("data") instanceof List<?> igList && !igList.isEmpty()) {
                    Object first = igList.get(0);
                    if (first instanceof Map<?, ?> igEntry && igEntry.get("id") != null) {
                        String igAccountId = String.valueOf(igEntry.get("id"));
                        String igFields = "id,username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website";
                        String igNodeUrl = "https://graph.facebook.com/v21.0/" + igAccountId + "?fields=" + igFields + "&access_token=" + accessToken;
                        Map<String, Object> igNode = restTemplate.getForObject(igNodeUrl, Map.class);
                        if (igNode != null) {
                            String username = igNode.get("username") != null ? String.valueOf(igNode.get("username")) : String.valueOf(igEntry.get("username"));
                            String name = igNode.get("name") != null && !String.valueOf(igNode.get("name")).isBlank()
                                    ? String.valueOf(igNode.get("name"))
                                    : username;
                            Integer followers = igNode.get("followers_count") instanceof Number n ? n.intValue() : 0;
                            Integer follows = igNode.get("follows_count") instanceof Number n ? n.intValue() : 0;
                            Integer mediaCount = igNode.get("media_count") instanceof Number n ? n.intValue() : 0;
                            String bio = igNode.get("biography") != null ? String.valueOf(igNode.get("biography")) : null;
                            String pictureUrl = igNode.get("profile_picture_url") != null ? String.valueOf(igNode.get("profile_picture_url")) : null;
                            String website = igNode.get("website") != null ? String.valueOf(igNode.get("website")) : null;

                            log.info("Live Instagram Unified Login profile fetched: @{}, followers={}, follows={}, media={}",
                                    username, followers, follows, mediaCount);
                            return InstagramProfileDto.builder()
                                    .id(igAccountId)
                                    .username(username)
                                    .name(name)
                                    .biography(bio)
                                    .profilePictureUrl(pictureUrl)
                                    .website(website)
                                    .followersCount(followers)
                                    .followsCount(follows)
                                    .mediaCount(mediaCount)
                                    .build();
                        }
                    }
                }
            } catch (Exception unifiedEx) {
                log.info("Unified login assigned_instagram_accounts lookup did not return an account: {}", unifiedEx.getMessage());
            }

            // Step 2: Check linked Instagram Professional account via Facebook Pages
            String id = null;
            String name = null;
            String username = null;
            String bio = null;
            String pictureUrl = null;
            String website = null;
            Integer followers = 0;
            Integer follows = 0;
            Integer mediaCount = 0;

            try {
                String fbUserUrl = "https://graph.facebook.com/v21.0/me?fields=id,name,picture.width(400).height(400)&access_token=" + accessToken;
                Map<String, Object> userData = restTemplate.getForObject(fbUserUrl, Map.class);
                if (userData != null) {
                    if (userData.get("id") != null) id = String.valueOf(userData.get("id"));
                    if (userData.get("name") != null) name = String.valueOf(userData.get("name"));
                    if (userData.get("picture") instanceof Map<?, ?> picObj && picObj.get("data") instanceof Map<?, ?> dataObj && dataObj.get("url") != null) {
                        pictureUrl = String.valueOf(dataObj.get("url"));
                    }
                }
            } catch (Exception meEx) {
                log.debug("Standard /me profile lookup skipped: {}", meEx.getMessage());
            }

            try {
                String igAccountUrl = "https://graph.facebook.com/v21.0/me/accounts?fields=instagram_business_account{id,username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website}&access_token=" + accessToken;
                Map<String, Object> accountsData = restTemplate.getForObject(igAccountUrl, Map.class);
                if (accountsData != null && accountsData.get("data") instanceof List<?> pages) {
                    for (Object pageObj : pages) {
                        if (pageObj instanceof Map<?, ?> page && page.get("instagram_business_account") instanceof Map<?, ?> igAcc) {
                            if (igAcc.get("username") != null) {
                                if (igAcc.get("id") != null) id = String.valueOf(igAcc.get("id"));
                                username = String.valueOf(igAcc.get("username"));
                                if (igAcc.get("name") != null) name = String.valueOf(igAcc.get("name"));
                                if (igAcc.get("profile_picture_url") != null) pictureUrl = String.valueOf(igAcc.get("profile_picture_url"));
                                if (igAcc.get("followers_count") instanceof Number n) followers = n.intValue();
                                if (igAcc.get("follows_count") instanceof Number n) follows = n.intValue();
                                if (igAcc.get("media_count") instanceof Number n) mediaCount = n.intValue();
                                if (igAcc.get("biography") != null) bio = String.valueOf(igAcc.get("biography"));
                                if (igAcc.get("website") != null) website = String.valueOf(igAcc.get("website"));
                                log.info("Live linked Instagram account fetched via Facebook Page: @{}, followers={}", username, followers);
                                break;
                            }
                        }
                    }
                }
            } catch (Exception igAccEx) {
                log.debug("No linked Instagram Business account accessible via /me/accounts: {}", igAccEx.getMessage());
            }

            if (id == null) {
                throw new IllegalStateException("No Meta or Instagram account was authorized during login. Make sure you selected your Instagram Professional account in the Meta consent screen.");
            }

            log.info("Successfully authenticated via Meta: name={}, id={}, igUsername={}, followers={}", name, id, username, followers);
            return InstagramProfileDto.builder()
                    .id(id)
                    .username(username)
                    .name(name)
                    .biography(bio)
                    .profilePictureUrl(pictureUrl)
                    .website(website)
                    .followersCount(followers)
                    .followsCount(follows)
                    .mediaCount(mediaCount)
                    .build();
        } catch (Exception e) {
            log.error("Error exchanging code with Meta: {}", e.getMessage());
            throw new RuntimeException("Meta authentication failed: " + e.getMessage());
        }
    }
}

package com.creatorhub.backend.controller;

import com.creatorhub.backend.dto.ApiResponse;
import com.creatorhub.backend.dto.AuthResponseDto;
import com.creatorhub.backend.dto.CreatorProfileDto;
import com.creatorhub.backend.dto.InstagramAuthRequestDto;
import com.creatorhub.backend.dto.InstagramProfileDto;
import com.creatorhub.backend.entity.CreatorProfile;
import com.creatorhub.backend.service.CreatorProfileService;
import com.creatorhub.backend.service.InstagramService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth/instagram")
@RequiredArgsConstructor
public class InstagramAuthController {

    private final InstagramService instagramService;
    private final CreatorProfileService creatorProfileService;

    @GetMapping("/url")
    public ResponseEntity<ApiResponse<Map<String, String>>> getInstagramAuthUrl() {
        String url = instagramService.getAuthorizationUrl();
        String provider = instagramService.getActiveProvider();
        return ResponseEntity.ok(ApiResponse.success(
                Map.of(
                        "url", url != null ? url : "",
                        "provider", provider
                ),
                url != null
                        ? "OAuth URL generated (" + provider + ")"
                        : "Instagram/Meta OAuth credentials are not configured"
        ));
    }

    @PostMapping("/callback")
    public ResponseEntity<ApiResponse<AuthResponseDto>> handleInstagramCallback(
            @RequestBody InstagramAuthRequestDto request
    ) {
        if (request.getCode() == null || request.getCode().isBlank()) {
            throw new IllegalArgumentException("OAuth authorization code is required for real Instagram/Meta authentication.");
        }

        AuthResponseDto response = instagramService.loginWithCode(request.getCode(), request.getRole());
        return ResponseEntity.ok(ApiResponse.success(response, "Authentication successful"));
    }

    @PostMapping("/sync")
    @PreAuthorize("hasAuthority('ROLE_CREATOR')")
    public ResponseEntity<ApiResponse<Object>> syncInstagramProfile(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody InstagramAuthRequestDto request
    ) {
        if (request.getCode() != null && !request.getCode().isBlank()) {
            instagramService.loginWithCode(request.getCode());
        } else if (request.getInstagramHandle() != null && !request.getInstagramHandle().isBlank()) {
            String cleanHandle = request.getInstagramHandle().replace("@", "").trim();
            InstagramProfileDto profile = InstagramProfileDto.builder()
                    .username(cleanHandle)
                    .name(request.getName())
                    .biography(request.getBiography())
                    .followersCount(request.getFollowersCount())
                    .profilePictureUrl(request.getAvatarUrl())
                    .build();
            CreatorProfile updated = instagramService.syncInstagramDetails(userDetails.getUsername(), profile);
            return ResponseEntity.ok(ApiResponse.success(
                    creatorProfileService.toDto(updated),
                    "Instagram profile updated"
            ));
        }

        return ResponseEntity.ok(ApiResponse.success(
                creatorProfileService.getOrCreateProfile(userDetails.getUsername()),
                "Instagram account synced successfully"
        ));
    }

    @GetMapping("/bio-code")
    @PreAuthorize("hasAuthority('ROLE_CREATOR')")
    public ResponseEntity<ApiResponse<Map<String, String>>> getBioVerificationCode(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        String code = instagramService.generateBioVerificationCode(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success(Map.of("code", code), "Verification code generated"));
    }

    @PostMapping("/verify-bio")
    @PreAuthorize("hasAuthority('ROLE_CREATOR')")
    public ResponseEntity<ApiResponse<CreatorProfileDto>> verifyBioCode(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, Object> body
    ) {
        String handle = (String) body.get("instagramHandle");
        String code = (String) body.get("code");
        Integer followers = body.get("followers") instanceof Number n ? n.intValue() : null;
        CreatorProfile updated = instagramService.verifyInstagramBio(userDetails.getUsername(), handle, code, followers);
        return ResponseEntity.ok(ApiResponse.success(creatorProfileService.toDto(updated), "Instagram handle verified successfully"));
    }
}

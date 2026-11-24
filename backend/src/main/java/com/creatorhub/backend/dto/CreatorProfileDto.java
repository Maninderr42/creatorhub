package com.creatorhub.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreatorProfileDto {

    private Long id;
    private Long userId;
    private String phone;
    private String email;
    private String displayName;
    private String bio;
    private String avatarUrl;
    private String city;
    private String country;
    private Double latitude;
    private Double longitude;
    private String categories;
    private String instagramHandle;
    private Integer instagramFollowers;
    private boolean isInstagramVerified;
    private String youtubeHandle;
    private Integer youtubeSubscribers;
    private String tiktokHandle;
    private Integer tiktokFollowers;
    private Double baseRate;
    private Long totalFollowers;
    private String portfolioLinks;
    private boolean isAvailable;
    private Double distanceKm;
    private Boolean isNearby;
}


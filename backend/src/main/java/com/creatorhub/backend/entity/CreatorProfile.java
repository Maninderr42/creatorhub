package com.creatorhub.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "creator_profiles", indexes = {
    @Index(name = "idx_creator_city", columnList = "city"),
    @Index(name = "idx_creator_categories", columnList = "categories")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreatorProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", unique = true, nullable = false)
    private User user;

    @Column(name = "display_name", length = 120)
    private String displayName;

    @Column(length = 1500)
    private String bio;

    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

    @Column(length = 100)
    private String city;

    @Column(length = 100)
    private String country;

    private Double latitude;

    private Double longitude;

    @Column(length = 255)
    private String categories;

    @Column(name = "instagram_handle", length = 100)
    private String instagramHandle;

    @Column(name = "instagram_followers")
    @Builder.Default
    private Integer instagramFollowers = 0;

    @Column(name = "is_instagram_verified", nullable = false)
    @Builder.Default
    private boolean isInstagramVerified = false;

    @Column(name = "youtube_handle", length = 100)
    private String youtubeHandle;

    @Column(name = "youtube_subscribers")
    @Builder.Default
    private Integer youtubeSubscribers = 0;

    @Column(name = "tiktok_handle", length = 100)
    private String tiktokHandle;

    @Column(name = "tiktok_followers")
    @Builder.Default
    private Integer tiktokFollowers = 0;

    @Column(name = "base_rate")
    @Builder.Default
    private Double baseRate = 0.0;

    @Column(name = "total_followers")
    @Builder.Default
    private Long totalFollowers = 0L;

    @Column(name = "portfolio_links", length = 2000)
    private String portfolioLinks;

    @Column(name = "is_available", nullable = false)
    @Builder.Default
    private boolean isAvailable = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
        recalculateTotalFollowers();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
        recalculateTotalFollowers();
    }

    public void recalculateTotalFollowers() {
        long total = 0;
        if (instagramFollowers != null) total += instagramFollowers;
        if (youtubeSubscribers != null) total += youtubeSubscribers;
        if (tiktokFollowers != null) total += tiktokFollowers;
        this.totalFollowers = total;
    }
}


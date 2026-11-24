package com.creatorhub.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InstagramAuthRequestDto {

    private String code;
    private String instagramHandle;
    private String name;
    private String biography;
    private Integer followersCount;
    private String avatarUrl;
    private String role;
}


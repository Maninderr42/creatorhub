package com.creatorhub.backend.service;

import com.creatorhub.backend.dto.CreatorProfileDto;
import com.creatorhub.backend.dto.CreatorProfileUpdateRequest;
import com.creatorhub.backend.entity.CreatorProfile;
import com.creatorhub.backend.entity.MerchantProfile;
import com.creatorhub.backend.entity.Role;
import com.creatorhub.backend.entity.User;
import com.creatorhub.backend.repository.CreatorProfileRepository;
import com.creatorhub.backend.repository.MerchantProfileRepository;
import com.creatorhub.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CreatorProfileService {

    private final CreatorProfileRepository creatorProfileRepository;
    private final MerchantProfileRepository merchantProfileRepository;
    private final UserRepository userRepository;

    @Transactional
    public CreatorProfileDto getOrCreateProfile(String phone) {
        User user = userRepository.findByPhone(phone)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + phone));

        if (user.getRole() != Role.CREATOR) {
            throw new AccessDeniedException("User is not registered as a creator");
        }

        CreatorProfile profile = creatorProfileRepository.findByUserId(user.getId())
                .orElseGet(() -> {
                    CreatorProfile newProfile = CreatorProfile.builder()
                            .user(user)
                            .displayName(user.getEmail() != null ? user.getEmail().split("@")[0] : "Creator " + user.getId())
                            .isAvailable(true)
                            .build();
                    return creatorProfileRepository.save(newProfile);
                });

        return toDto(profile);
    }

    @Transactional
    public CreatorProfileDto updateProfile(String phone, CreatorProfileUpdateRequest req) {
        User user = userRepository.findByPhone(phone)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + phone));

        CreatorProfile profile = creatorProfileRepository.findByUserId(user.getId())
                .orElseGet(() -> CreatorProfile.builder().user(user).build());

        if (req.getDisplayName() != null) profile.setDisplayName(req.getDisplayName());
        if (req.getBio() != null) profile.setBio(req.getBio());
        if (req.getAvatarUrl() != null) profile.setAvatarUrl(req.getAvatarUrl());
        if (req.getCity() != null) profile.setCity(req.getCity());
        if (req.getCountry() != null) profile.setCountry(req.getCountry());
        if (req.getLatitude() != null) profile.setLatitude(req.getLatitude());
        if (req.getLongitude() != null) profile.setLongitude(req.getLongitude());
        if (req.getCategories() != null) profile.setCategories(req.getCategories());
        if (req.getInstagramHandle() != null) profile.setInstagramHandle(req.getInstagramHandle());
        if (req.getInstagramFollowers() != null) profile.setInstagramFollowers(req.getInstagramFollowers());
        if (req.getYoutubeHandle() != null) profile.setYoutubeHandle(req.getYoutubeHandle());
        if (req.getYoutubeSubscribers() != null) profile.setYoutubeSubscribers(req.getYoutubeSubscribers());
        if (req.getTiktokHandle() != null) profile.setTiktokHandle(req.getTiktokHandle());
        if (req.getTiktokFollowers() != null) profile.setTiktokFollowers(req.getTiktokFollowers());
        if (req.getBaseRate() != null) profile.setBaseRate(req.getBaseRate());
        if (req.getPortfolioLinks() != null) profile.setPortfolioLinks(req.getPortfolioLinks());
        if (req.getIsAvailable() != null) profile.setAvailable(req.getIsAvailable());

        profile.recalculateTotalFollowers();
        CreatorProfile saved = creatorProfileRepository.save(profile);
        return toDto(saved);
    }

    @Transactional(readOnly = true)
    public List<CreatorProfileDto> searchCreators(String category, String city, Long minFollowers, String search) {
        return creatorProfileRepository.searchCreators(category, city, minFollowers, search)
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CreatorProfileDto> searchCreatorsForMerchant(
            String merchantPhone,
            String category,
            String cityFilter,
            Double customLat,
            Double customLng,
            Long minFollowers,
            String search,
            Boolean nearbyOnly,
            Double radiusKm
    ) {
        final double maxRadius = (radiusKm != null && radiusKm > 0) ? radiusKm : 10.0;

        // Resolve brand owner's location
        String brandCity = null;
        Double brandLat = customLat;
        Double brandLng = customLng;

        if (merchantPhone != null && !merchantPhone.isBlank()) {
            Optional<MerchantProfile> merchantOpt = merchantProfileRepository.findByUserPhone(merchantPhone);
            if (merchantOpt.isPresent()) {
                MerchantProfile m = merchantOpt.get();
                if (m.getCity() != null && !m.getCity().isBlank()) {
                    brandCity = m.getCity().trim();
                }
                if (brandLat == null && m.getLatitude() != null) {
                    brandLat = m.getLatitude();
                }
                if (brandLng == null && m.getLongitude() != null) {
                    brandLng = m.getLongitude();
                }
            }
        }

        final String activeCityFilter = (cityFilter != null && !cityFilter.isBlank()) ? cityFilter.trim() : null;
        final String targetCity = activeCityFilter != null ? activeCityFilter : brandCity;
        final Double effectiveLat = brandLat;
        final Double effectiveLng = brandLng;

        // Query available creators matching category, minFollowers, search
        List<CreatorProfile> rawCreators = creatorProfileRepository.searchCreators(category, null, minFollowers, search);

        // Map and compute proximity
        List<CreatorProfileDto> list = rawCreators.stream().map(c -> {
            CreatorProfileDto dto = toDto(c);

            Double distance = null;
            if (effectiveLat != null && effectiveLng != null && c.getLatitude() != null && c.getLongitude() != null) {
                distance = calculateHaversineDistanceKm(effectiveLat, effectiveLng, c.getLatitude(), c.getLongitude());
            }

            boolean isNearby = false;
            if (distance != null && distance <= maxRadius) {
                isNearby = true;
            } else if (distance == null && targetCity != null && c.getCity() != null && !c.getCity().isBlank()) {
                if (c.getCity().trim().equalsIgnoreCase(targetCity.trim()) ||
                    c.getCity().toLowerCase().contains(targetCity.toLowerCase()) ||
                    targetCity.toLowerCase().contains(c.getCity().toLowerCase())) {
                    isNearby = true;
                }
            }

            dto.setDistanceKm(distance);
            dto.setIsNearby(isNearby);
            return dto;
        }).collect(Collectors.toList());

        // Sort: Nearby creators FIRST, then by follower count
        list.sort((a, b) -> {
            boolean aNear = Boolean.TRUE.equals(a.getIsNearby());
            boolean bNear = Boolean.TRUE.equals(b.getIsNearby());

            if (aNear && !bNear) return -1;
            if (!aNear && bNear) return 1;

            if (a.getDistanceKm() != null && b.getDistanceKm() != null) {
                return Double.compare(a.getDistanceKm(), b.getDistanceKm());
            }
            if (a.getDistanceKm() != null) return -1;
            if (b.getDistanceKm() != null) return 1;

            long aFoll = a.getTotalFollowers() != null ? a.getTotalFollowers() : 0L;
            long bFoll = b.getTotalFollowers() != null ? b.getTotalFollowers() : 0L;
            return Long.compare(bFoll, aFoll);
        });

        // If explicit city filter was provided in the search bar (and not searching via GPS coordinates), filter to matching creators
        if (activeCityFilter != null && (effectiveLat == null || effectiveLng == null)) {
            list = list.stream()
                    .filter(c -> c.getCity() != null && (
                            c.getCity().toLowerCase().contains(activeCityFilter.toLowerCase()) ||
                            activeCityFilter.toLowerCase().contains(c.getCity().toLowerCase())
                    ))
                    .collect(Collectors.toList());
        }

        // If nearbyOnly is requested, strictly retain only creators matching the merchant's area
        if (Boolean.TRUE.equals(nearbyOnly)) {
            list = list.stream()
                    .filter(c -> Boolean.TRUE.equals(c.getIsNearby()))
                    .collect(Collectors.toList());
        }

        return list;
    }

    private double calculateHaversineDistanceKm(double lat1, double lon1, double lat2, double lon2) {
        final int R = 6371; // Earth radius in km
        double latDist = Math.toRadians(lat2 - lat1);
        double lonDist = Math.toRadians(lon2 - lon1);
        double a = Math.sin(latDist / 2) * Math.sin(latDist / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(lonDist / 2) * Math.sin(lonDist / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c * 10.0) / 10.0;
    }

    @Transactional(readOnly = true)
    public CreatorProfileDto getPublicCreatorProfile(Long creatorUserId) {
        CreatorProfile profile = creatorProfileRepository.findByUserId(creatorUserId)
                .orElseThrow(() -> new IllegalArgumentException("Creator profile not found for user id: " + creatorUserId));
        return toDto(profile);
    }

    @Transactional(readOnly = true)
    public CreatorProfileDto getPublicCreatorProfileForMerchant(String merchantPhone, Long creatorUserId) {
        CreatorProfile profile = creatorProfileRepository.findByUserId(creatorUserId)
                .orElseThrow(() -> new IllegalArgumentException("Creator profile not found for user id: " + creatorUserId));
        CreatorProfileDto dto = toDto(profile);

        if (merchantPhone != null) {
            MerchantProfile m = merchantProfileRepository.findByUserPhone(merchantPhone).orElse(null);
            if (m != null) {
                if (m.getLatitude() != null && m.getLongitude() != null && profile.getLatitude() != null && profile.getLongitude() != null) {
                    double dist = calculateHaversineDistanceKm(m.getLatitude(), m.getLongitude(), profile.getLatitude(), profile.getLongitude());
                    dto.setDistanceKm(dist);
                    dto.setIsNearby(dist <= 10.0);
                } else if (m.getCity() != null && profile.getCity() != null && !profile.getCity().isBlank()) {
                    boolean matches = profile.getCity().trim().equalsIgnoreCase(m.getCity().trim())
                            || profile.getCity().toLowerCase().contains(m.getCity().toLowerCase())
                            || m.getCity().toLowerCase().contains(profile.getCity().toLowerCase());
                    dto.setIsNearby(matches);
                }
            }
        }
        return dto;
    }

    public CreatorProfileDto toDto(CreatorProfile profile) {
        return CreatorProfileDto.builder()
                .id(profile.getId())
                .userId(profile.getUser().getId())
                .phone(profile.getUser().getPhone())
                .email(profile.getUser().getEmail())
                .displayName(profile.getDisplayName())
                .bio(profile.getBio())
                .avatarUrl(profile.getAvatarUrl())
                .city(profile.getCity())
                .country(profile.getCountry())
                .latitude(profile.getLatitude())
                .longitude(profile.getLongitude())
                .categories(profile.getCategories())
                .instagramHandle(profile.getInstagramHandle())
                .instagramFollowers(profile.getInstagramFollowers())
                .isInstagramVerified(profile.isInstagramVerified())
                .youtubeHandle(profile.getYoutubeHandle())
                .youtubeSubscribers(profile.getYoutubeSubscribers())
                .tiktokHandle(profile.getTiktokHandle())
                .tiktokFollowers(profile.getTiktokFollowers())
                .baseRate(profile.getBaseRate())
                .totalFollowers(profile.getTotalFollowers())
                .portfolioLinks(profile.getPortfolioLinks())
                .isAvailable(profile.isAvailable())
                .build();
    }
}


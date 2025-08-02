// components/RatingModal.tsx
import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  Dimensions,
  Pressable,
} from "react-native";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { colors } from "@/utils/colors";

const { width } = Dimensions.get("window");

interface RatingModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (rating: number) => void;
  driverName?: string;
}

export default function RatingModal({
  visible,
  onClose,
  onSubmit,
  driverName = "your driver",
}: RatingModalProps) {
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [comment, setComment] = useState("");

  const handleSubmit = () => {
    if (selectedRating === 0) {
      Alert.alert(
        "Rating Required",
        "Please select a rating before submitting.",
      );
      return;
    }

    onSubmit(selectedRating);
    // Reset state
    setSelectedRating(0);
    setComment("");
  };

  const handleClose = () => {
    setSelectedRating(0);
    setComment("");
    onClose();
  };

  const renderStarRating = () => {
    return (
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          marginBottom: 24,
        }}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setSelectedRating(star)}
            style={{
              padding: 8,
              marginHorizontal: 4,
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={selectedRating >= star ? "star" : "star-outline"}
              size={36}
              color={selectedRating >= star ? "#FFD700" : colors.textSecondary}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const getRatingText = () => {
    switch (selectedRating) {
      case 1:
        return "Poor";
      case 2:
        return "Fair";
      case 3:
        return "Good";
      case 4:
        return "Very Good";
      case 5:
        return "Excellent";
      default:
        return "Tap a star to rate";
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
        onPress={handleClose}
      >
        <Pressable
          style={{
            backgroundColor: colors.background,
            borderRadius: 24,
            padding: 28,
            width: width - 40,
            maxWidth: 400,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 12,
          }}
          onPress={() => {}} // Prevent closing when tapping inside modal
        >
          {/* Header */}
          <View style={{ alignItems: "center", marginBottom: 24 }}>
            <View
              style={{
                backgroundColor: colors.primary + "20",
                padding: 16,
                borderRadius: 20,
                marginBottom: 16,
              }}
            >
              <MaterialIcons name="star" size={32} color={colors.primary} />
            </View>
            <Text
              style={{
                color: colors.text,
                fontSize: 24,
                fontWeight: "700",
                marginBottom: 8,
                textAlign: "center",
              }}
            >
              Rate Your Ride
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 16,
                textAlign: "center",
                lineHeight: 22,
              }}
            >
              How was your experience with {driverName}?
            </Text>
          </View>

          {/* Star Rating */}
          {renderStarRating()}

          {/* Rating Text */}
          <Text
            style={{
              color: colors.primary,
              fontSize: 18,
              fontWeight: "600",
              textAlign: "center",
              marginBottom: 24,
              minHeight: 24,
            }}
          >
            {getRatingText()}
          </Text>

          {/* Comment Input (Optional) */}
          <View style={{ marginBottom: 28 }}>
            <Text
              style={{
                color: colors.text,
                fontSize: 16,
                fontWeight: "600",
                marginBottom: 12,
              }}
            >
              Add a comment (optional)
            </Text>
            <TextInput
              style={{
                backgroundColor: colors.bg_accent,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 16,
                padding: 16,
                color: colors.text,
                fontSize: 16,
                minHeight: 80,
                textAlignVertical: "top",
              }}
              placeholder="Share your feedback..."
              placeholderTextColor={colors.textSecondary}
              value={comment}
              onChangeText={setComment}
              multiline
              maxLength={200}
            />
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 12,
                textAlign: "right",
                marginTop: 8,
              }}
            >
              {comment.length}/200
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity
              onPress={handleClose}
              style={{
                flex: 1,
                backgroundColor: colors.bg_accent,
                padding: 16,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontWeight: "600",
                  fontSize: 16,
                }}
              >
                Skip
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              style={{
                flex: 1,
                backgroundColor: colors.primary,
                padding: 16,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
              }}
            >
              <Text
                style={{
                  color: colors.background,
                  fontWeight: "700",
                  fontSize: 16,
                }}
              >
                Submit Rating
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

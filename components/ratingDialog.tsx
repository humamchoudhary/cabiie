// utils/ratingDialog.ts
import { Alert } from "react-native";

export const showRatingDialog = (): Promise<number | null> => {
  return new Promise((resolve) => {
    Alert.prompt(
      "Rate Your Ride",
      "How would you rate your experience with this driver? (1-5)",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => resolve(null),
        },
        {
          text: "Submit",
          onPress: (text) => {
            if (!text) return resolve(null);
            const rating = parseFloat(text);
            if (isNaN(rating) || rating < 1 || rating > 5) {
              Alert.alert(
                "Invalid Rating",
                "Please enter a number between 1 and 5",
              );
              resolve(null);
            } else {
              resolve(rating);
            }
          },
        },
      ],
      "plain-text",
      "",
      "numeric",
    );
  });
};

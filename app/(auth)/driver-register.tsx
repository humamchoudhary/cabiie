import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Image,
  ScrollView,
} from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, firestore, storage } from "@/config/firebase";
import { useRouter } from "expo-router";
import { doc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { colors } from "@/utils/colors";
import { MaterialIcons } from "@expo/vector-icons";

export default function DriverRegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [cnic, setCnic] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleType, setVehicleType] = useState("car");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [cnicImage, setCnicImage] = useState<string | null>(null);
  const [licenseImage, setLicenseImage] = useState<string | null>(null);
  const [cameraPermissions, requestCameraPermission] = useCameraPermissions();
  const [activeCamera, setActiveCamera] = useState<
    "profile" | "cnic" | "license" | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();

  useEffect(() => {
    if (!cameraPermissions) {
      requestCameraPermission();
    }
  }, []);

  const takePicture = async () => {
    if (cameraRef.current && activeCamera) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
        });

        switch (activeCamera) {
          case "profile":
            setProfileImage(photo.uri);
            break;
          case "cnic":
            setCnicImage(photo.uri);
            break;
          case "license":
            setLicenseImage(photo.uri);
            break;
        }

        setActiveCamera(null);
      } catch (error) {
        setError("Failed to take picture");
      }
    }
  };

  const pickImage = async (type: "profile" | "cnic" | "license") => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      switch (type) {
        case "profile":
          setProfileImage(result.assets[0].uri);
          break;
        case "cnic":
          setCnicImage(result.assets[0].uri);
          break;
        case "license":
          setLicenseImage(result.assets[0].uri);
          break;
      }
    }
  };

  const uploadImage = async (uri: string, path: string) => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  };

  const handleRegister = async () => {
    // Validate all fields
    if (
      !name ||
      !email ||
      !phone ||
      !password ||
      !confirmPassword ||
      !cnic ||
      !licenseNumber ||
      !licensePlate ||
      !vehicleModel ||
      !profileImage ||
      !cnicImage ||
      !licenseImage
    ) {
      setError("Please fill all fields and upload all required images");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Create user with email/password
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );

      // Upload all images
      const [profileUrl, cnicUrl, licenseUrl] = await Promise.all([
        uploadImage(
          profileImage,
          `drivers/${userCredential.user.uid}/profile.jpg`,
        ),
        uploadImage(cnicImage, `drivers/${userCredential.user.uid}/cnic.jpg`),
        uploadImage(
          licenseImage,
          `drivers/${userCredential.user.uid}/license.jpg`,
        ),
      ]);

      // Update user profile
      await updateProfile(userCredential.user, {
        displayName: name,
        photoURL: profileUrl,
      });

      // Create driver document in Firestore
      await setDoc(doc(firestore, "users", userCredential.user.uid), {
        name,
        email,
        phone,
        photoURL: profileUrl,
        userType: "driver",
        cnic,
        cnicImage: cnicUrl,
        licenseNumber,
        licenseImage: licenseUrl,
        vehicleInfo: {
          licensePlate,
          model: vehicleModel,
          type: vehicleType,
        },
        driverStatus: "pending", // Needs admin approval
        createdAt: new Date().toISOString(),
        rating: 5, // Default rating for new drivers
        tripsCompleted: 0,
        earnings: 0,
      });

      // Redirect to driver home (or application pending screen)
      router.replace("/(driver)/home");
    } catch (error: any) {
      console.error("Registration error:", error);
      setError(error.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderImageUpload = (
    title: string,
    image: string | null,
    setImage: (uri: string) => void,
    type: "profile" | "cnic" | "license",
  ) => (
    <View className="mb-6">
      <Text className="mb-2 font-medium" style={{ color: colors.text }}>
        {title} {!image && "(Required)"}
      </Text>

      {image ? (
        <View className="items-center">
          <Image
            source={{ uri: image }}
            style={{
              width: 150,
              height: 150,
              borderRadius: 8,
              marginBottom: 10,
              borderWidth: 2,
              borderColor: colors.primary,
            }}
          />
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => setActiveCamera(type)}
              className="p-2 rounded flex-1 items-center"
              style={{ backgroundColor: colors.primaryLight }}
            >
              <Text style={{ color: colors.bg_accent }}>Retake Photo</Text>
            </Pressable>
            <Pressable
              onPress={() => pickImage(type)}
              className="p-2 rounded flex-1 items-center"
              style={{ backgroundColor: colors.secondaryLight }}
            >
              <Text style={{ color: colors.bg_accent }}>Choose Different</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => setActiveCamera(type)}
            disabled={!cameraPermissions?.granted}
            className="p-3 rounded flex-1 items-center"
            style={{
              backgroundColor: colors.primaryLight,
              opacity: cameraPermissions?.granted ? 1 : 0.6,
            }}
          >
            <MaterialIcons
              name="camera-alt"
              size={24}
              color={colors.bg_accent}
            />
            <Text style={{ color: colors.bg_accent }}>Take Photo</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  if (activeCamera) {
    return (
      <View style={{ flex: 1 }}>
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" />
        <View className="absolute bottom-4 left-0 right-0 p-4">
          <Pressable
            onPress={takePicture}
            className="p-3 rounded-full self-center"
            style={{
              backgroundColor: colors.primary,
              width: 70,
              height: 70,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <MaterialIcons name="camera" size={32} color="white" />
          </Pressable>
          <Pressable
            onPress={() => setActiveCamera(null)}
            className="mt-4 p-2 rounded self-center"
            style={{ backgroundColor: colors.primary }}
          >
            <Text className="text-white">Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 p-6 pb-10"
      style={{ backgroundColor: colors.background }}
    >
      <Text className="text-2xl font-bold mb-6" style={{ color: colors.text }}>
        Driver Registration
      </Text>

      {error ? (
        <Text className="text-red-500 mb-4 text-center">{error}</Text>
      ) : null}

      <Text className="text-lg font-medium mb-4" style={{ color: colors.text }}>
        Personal Information
      </Text>

      {renderImageUpload(
        "Profile Picture",
        profileImage,
        setProfileImage,
        "profile",
      )}

      <TextInput
        placeholder="Full Name"
        placeholderTextColor={colors.textSecondary}
        value={name}
        onChangeText={setName}
        className="p-4 rounded-lg mb-4"
        style={{
          backgroundColor: colors.bg_accent,
          color: colors.text,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      />

      <TextInput
        placeholder="Email"
        placeholderTextColor={colors.textSecondary}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        className="p-4 rounded-lg mb-4"
        style={{
          backgroundColor: colors.bg_accent,
          color: colors.text,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      />

      <TextInput
        placeholder="Phone Number"
        placeholderTextColor={colors.textSecondary}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        className="p-4 rounded-lg mb-4"
        style={{
          backgroundColor: colors.bg_accent,
          color: colors.text,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      />

      <TextInput
        placeholder="Password (min 6 characters)"
        placeholderTextColor={colors.textSecondary}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        className="p-4 rounded-lg mb-4"
        style={{
          backgroundColor: colors.bg_accent,
          color: colors.text,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      />

      <TextInput
        placeholder="Confirm Password"
        placeholderTextColor={colors.textSecondary}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        className="p-4 rounded-lg mb-6"
        style={{
          backgroundColor: colors.bg_accent,
          color: colors.text,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      />

      <Text className="text-lg font-medium mb-4" style={{ color: colors.text }}>
        Driver Documents
      </Text>

      <TextInput
        placeholder="CNIC Number (without dashes)"
        placeholderTextColor={colors.textSecondary}
        value={cnic}
        onChangeText={setCnic}
        keyboardType="numeric"
        className="p-4 rounded-lg mb-4"
        style={{
          backgroundColor: colors.bg_accent,
          color: colors.text,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      />

      {renderImageUpload("CNIC Picture", cnicImage, setCnicImage, "cnic")}

      <TextInput
        placeholder="Driver License Number"
        placeholderTextColor={colors.textSecondary}
        value={licenseNumber}
        onChangeText={setLicenseNumber}
        className="p-4 rounded-lg mb-4"
        style={{
          backgroundColor: colors.bg_accent,
          color: colors.text,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      />

      {renderImageUpload(
        "Driver License Picture",
        licenseImage,
        setLicenseImage,
        "license",
      )}

      <Text className="text-lg font-medium mb-4" style={{ color: colors.text }}>
        Vehicle Information
      </Text>

      <TextInput
        placeholder="License Plate Number"
        placeholderTextColor={colors.textSecondary}
        value={licensePlate}
        onChangeText={setLicensePlate}
        className="p-4 rounded-lg mb-4"
        style={{
          backgroundColor: colors.bg_accent,
          color: colors.text,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      />

      <TextInput
        placeholder="Vehicle Model"
        placeholderTextColor={colors.textSecondary}
        value={vehicleModel}
        onChangeText={setVehicleModel}
        className="p-4 rounded-lg mb-4"
        style={{
          backgroundColor: colors.bg_accent,
          color: colors.text,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      />

      <View className="mb-6">
        <Text className="mb-2" style={{ color: colors.text }}>
          Vehicle Type
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {["bike", "car", "car_plus", "premium"].map((type) => (
            <Pressable
              key={type}
              onPress={() => setVehicleType(type)}
              className="px-4 py-2 rounded-full"
              style={{
                backgroundColor:
                  vehicleType === type ? colors.primary : colors.bg_accent,
              }}
            >
              <Text
                style={{
                  color: vehicleType === type ? "white" : colors.text,
                  textTransform: "capitalize",
                }}
              >
                {type.replace("_", " ")}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable
        onPress={handleRegister}
        disabled={loading}
        className="p-4 rounded-lg mb-4"
        style={{
          backgroundColor: loading ? colors.primaryLight : colors.primary,
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-center font-bold text-white">
            Submit Application
          </Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => router.back()}
        className="p-2"
        style={{ marginBottom: 20 }}
      >
        <Text className="text-center" style={{ color: colors.secondary }}>
          Back to role selection
        </Text>
      </Pressable>
    </ScrollView>
  );
}

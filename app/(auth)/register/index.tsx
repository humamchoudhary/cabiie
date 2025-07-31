// // app/(auth)/register/page.tsx
// import { useState, useRef, useEffect } from "react";
// import {
//   View,
//   Text,
//   TextInput,
//   Pressable,
//   ActivityIndicator,
//   Image,
// } from "react-native";
// import { Camera, CameraType } from "expo-camera";
// import * as ImagePicker from "expo-image-picker";
// import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
// import { auth, firestore, storage } from "@/config/firebase";
// import { useRouter, useLocalSearchParams } from "expo-router";
// import { doc, setDoc } from "firebase/firestore";
// import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
// import * as ImageManipulator from "expo-image-manipulator";
// import { colors } from "@/utils/colors";

// export default function RegisterScreen() {
//   const [name, setName] = useState("");
//   const [email, setEmail] = useState("");
//   const [phone, setPhone] = useState("");
//   const [cnic, setCnic] = useState("");
//   const [licensePlate, setLicensePlate] = useState("");
//   const [vehicleModel, setVehicleModel] = useState("");
//   const [vehicleType, setVehicleType] = useState("car");
//   const [capturedImage, setCapturedImage] = useState<string | null>(null);
//   const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");
//   const cameraRef = useRef<Camera>(null);
//   const router = useRouter();
//   const params = useLocalSearchParams();
//   const role = params.role as "user" | "driver";

//   useEffect(() => {
//     (async () => {
//       const { status } = await Camera.requestCameraPermissionsAsync();
//       setCameraPermission(status === "granted");
      
//       // If no role is selected, go back to role selection
//       if (!params.role) {
//         router.push("/(auth)/role-selection");
//       }
//     })();
//   }, []);

//   const takePicture = async () => {
//     if (cameraRef.current) {
//       try {
//         const photo = await cameraRef.current.takePictureAsync({
//           quality: 0.7,
//           base64: true,
//         });
        
//         const compressedPhoto = await ImageManipulator.manipulateAsync(
//           photo.uri,
//           [],
//           { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
//         );
        
//         setCapturedImage(compressedPhoto.uri);
//       } catch (error) {
//         setError("Failed to take picture");
//       }
//     }
//   };

//   const pickImage = async () => {
//     let result = await ImagePicker.launchImageLibraryAsync({
//       mediaTypes: ImagePicker.MediaTypeOptions.Images,
//       allowsEditing: true,
//       aspect: [4, 3],
//       quality: 0.7,
//       base64: true,
//     });

//     if (!result.canceled) {
//       setCapturedImage(result.assets[0].uri);
//     }
//   };

//   const uploadImage = async (uri: string, userId: string) => {
//     const response = await fetch(uri);
//     const blob = await response.blob();
//     const storageRef = ref(storage, `profilePictures/${userId}`);
//     await uploadBytes(storageRef, blob);
//     return await getDownloadURL(storageRef);
//   };

//   const handleRegister = async () => {
//     if (!role) {
//       setError("Please select a role");
//       return;
//     }

//     if (!capturedImage) {
//       setError("Please take a profile picture");
//       return;
//     }

//     setLoading(true);
//     setError("");

//     try {
//       // Create user with email/password
//       const userCredential = await createUserWithEmailAndPassword(
//         auth,
//         email,
//         "defaultPassword" // In production, implement proper password handling
//       );

//       // Upload profile image
//       const photoURL = await uploadImage(capturedImage, userCredential.user.uid);

//       // Update user profile
//       await updateProfile(auth.currentUser!, {
//         displayName: name,
//         photoURL,
//       });

//       // Create user document in Firestore
//       const userData = {
//         name,
//         email,
//         phone,
//         photoURL,
//         userType: role,
//         createdAt: new Date().toISOString(),
//         ...(role === "driver" && {
//           driverStatus: "pending",
//           cnic,
//           vehicleInfo: {
//             licensePlate,
//             model: vehicleModel,
//             type: vehicleType,
//           }
//         })
//       };

//       await setDoc(doc(firestore, "users", userCredential.user.uid), userData);

//       // Redirect based on role
//       router.replace(role === "user" ? "/(user)/home" : "/(driver)/home");
//     } catch (error: any) {
//       console.error("Registration error:", error);
//       setError(error.message || "Registration failed. Please try again.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <View className="flex-1 p-6 justify-center" style={{ backgroundColor: colors.background }}>
//       <Text className="text-2xl font-bold mb-6" style={{ color: colors.text }}>
//         Register as {role === "user" ? "Passenger" : "Driver"}
//       </Text>

//       {error ? (
//         <Text className="text-red-500 mb-4 text-center">{error}</Text>
//       ) : null}

//       <TextInput
//         placeholder="Full Name"
//         placeholderTextColor={colors.text}
//         value={name}
//         onChangeText={setName}
//         className="p-3 rounded mb-4"
//         style={{ 
//           backgroundColor: colors.bg_accent,
//           color: colors.text 
//         }}
//       />

//       <TextInput
//         placeholder="Email"
//         placeholderTextColor={colors.text}
//         value={email}
//         onChangeText={setEmail}
//         keyboardType="email-address"
//         autoCapitalize="none"
//         className="p-3 rounded mb-4"
//         style={{ 
//           backgroundColor: colors.bg_accent,
//           color: colors.text 
//         }}
//       />

//       <TextInput
//         placeholder="Phone Number"
//         placeholderTextColor={colors.text}
//         value={phone}
//         onChangeText={setPhone}
//         keyboardType="phone-pad"
//         className="p-3 rounded mb-4"
//         style={{ 
//           backgroundColor: colors.bg_accent,
//           color: colors.text 
//         }}
//       />

//       {role === "driver" && (
//         <>
//           <TextInput
//             placeholder="CNIC (without dashes)"
//             placeholderTextColor={colors.text}
//             value={cnic}
//             onChangeText={setCnic}
//             keyboardType="numeric"
//             className="p-3 rounded mb-4"
//             style={{ 
//               backgroundColor: colors.bg_accent,
//               color: colors.text 
//             }}
//           />

//           <TextInput
//             placeholder="License Plate"
//             placeholderTextColor={colors.text}
//             value={licensePlate}
//             onChangeText={setLicensePlate}
//             className="p-3 rounded mb-4"
//             style={{ 
//               backgroundColor: colors.bg_accent,
//               color: colors.text 
//             }}
//           />

//           <TextInput
//             placeholder="Vehicle Model"
//             placeholderTextColor={colors.text}
//             value={vehicleModel}
//             onChangeText={setVehicleModel}
//             className="p-3 rounded mb-4"
//             style={{ 
//               backgroundColor: colors.bg_accent,
//               color: colors.text 
//             }}
//           />
//         </>
//       )}

//       <View className="mb-6">
//         <Text style={{ color: colors.text, marginBottom: 8 }}>
//           Profile Picture (Required)
//         </Text>
        
//         {capturedImage ? (
//           <View className="items-center">
//             <Image 
//               source={{ uri: capturedImage }} 
//               style={{ 
//                 width: 150, 
//                 height: 150, 
//                 borderRadius: 75,
//                 marginBottom: 10,
//                 borderWidth: 2,
//                 borderColor: colors.primary
//               }} 
//             />
//             <View className="flex-row gap-4">
//               <Pressable
//                 onPress={() => setCapturedImage(null)}
//                 className="p-2 rounded flex-1"
//                 style={{ backgroundColor: colors.primary }}
//               >
//                 <Text style={{ color: colors.text, textAlign: 'center' }}>Retake</Text>
//               </Pressable>
//               <Pressable
//                 onPress={pickImage}
//                 className="p-2 rounded flex-1"
//                 style={{ backgroundColor: colors.secondary }}
//               >
//                 <Text style={{ color: colors.text, textAlign: 'center' }}>Choose Different</Text>
//               </Pressable>
//             </View>
//           </View>
//         ) : (
//           <View className="items-center">
//             {cameraPermission ? (
//               <View style={{ width: '100%', aspectRatio: 1, marginBottom: 16 }}>
//                 <Camera 
//                   ref={cameraRef}
//                   style={{ flex: 1, borderRadius: 8 }}
//                   type={CameraType.front}
//                 />
//                 <Pressable
//                   onPress={takePicture}
//                   className="p-3 rounded-full absolute bottom-4 self-center"
//                   style={{ 
//                     backgroundColor: colors.primary,
//                     width: 60,
//                     height: 60,
//                     justifyContent: 'center',
//                     alignItems: 'center'
//                   }}
//                 >
//                   <Text style={{ color: colors.text }}>📸</Text>
//                 </Pressable>
//               </View>
//             ) : null}
//             <Pressable
//               onPress={pickImage}
//               className="p-3 rounded w-full"
//               style={{ backgroundColor: colors.secondary }}
//             >
//               <Text style={{ color: colors.text, textAlign: 'center' }}>
//                 {cameraPermission ? 'Or select from gallery' : 'Select from gallery'}
//               </Text>
//             </Pressable>
//           </View>
//         )}
//       </View>

//       <Pressable
//         onPress={handleRegister}
//         disabled={loading}
//         className="p-4 rounded-lg mb-4"
//         style={{ 
//           backgroundColor: loading ? colors.bg_accent : colors.primary,
//           opacity: loading ? 0.7 : 1
//         }}
//       >
//         {loading ? (
//           <ActivityIndicator color={colors.text} />
//         ) : (
//           <Text className="text-center font-medium" style={{ color: colors.text }}>
//             Complete Registration
//           </Text>
//         )}
//       </Pressable>

//       <Pressable 
//         onPress={() => router.push("/(auth)/role-selection")}
//         className="p-2"
//       >
//         <Text className="text-center" style={{ color: colors.secondary }}>
//           Change role
//         </Text>
//       </Pressable>
//     </View>
//   );
// }
// utils/seedDrivers.ts
import { database, firestore } from "@/config/firebase";
import { ref, set } from "firebase/database";
import { doc, setDoc } from "firebase/firestore";

export async function seedDemoDrivers() {
  console.log("Add drivers");
  const demoDrivers = [
    {
      id: "driver1",
      name: "John Doe",
      vehicleType: "car",
      vehicleModel: "Toyota Camry",
      licensePlate: "ABC123",
      rating: 4.8,
      location: {
        latitude: 37.78825,
        longitude: -122.4324,
      },
    },
    {
      id: "driver2",
      name: "Jane Smith",
      vehicleType: "car_plus",
      vehicleModel: "Honda Accord",
      licensePlate: "XYZ789",
      rating: 4.9,
      location: {
        latitude: 37.78925,
        longitude: -122.4334,
      },
    },
    {
      id: "driver3",
      name: "Mike Johnson",
      vehicleType: "bike",
      vehicleModel: "Yamaha FZ",
      licensePlate: "BIKE001",
      rating: 4.7,
      location: {
        latitude: 37.78725,
        longitude: -122.4314,
      },
    },
  ];

  // Seed to Firestore (user data)
  for (const driver of demoDrivers) {
    console.log(driver);
    await setDoc(doc(firestore, "drivers", driver.id), {
      name: driver.name,
      userType: "driver",
      vehicleInfo: {
        type: driver.vehicleType,
        model: driver.vehicleModel,
        licensePlate: driver.licensePlate,
      },
      rating: driver.rating,
      status: "available",
    }).catch((e) => console.log(e));

    // Seed to Realtime DB (location data)
    await set(ref(database, `drivers/${driver.id}`), {
      latitude: driver.location.latitude,
      longitude: driver.location.longitude,
      lastUpdated: Date.now(),
      status: "available",
      rideType: driver.vehicleType === "bike" ? ["bike"] : ["car", "car_plus"],
    });
    console.log("Done");
  }

  console.log("Demo drivers seeded successfully");
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, updateProfile, signOut, signInWithCustomToken, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, collection, addDoc, onSnapshot, query, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
const appId = 'geo-info-prajwal-pp7';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const uploadContainer = document.getElementById('upload-container');
const imageUpload = document.getElementById('image-upload');
const resultContainer = document.getElementById('result-container');
const imagePreview = document.getElementById('image-preview');
const analyzeButton = document.getElementById('analyze-button');
const loader = document.getElementById('loader');
const mapAndInfo = document.getElementById('map-and-info');
const placeName = document.getElementById('place-name');
const infoContent = document.getElementById('info-content');
const errorMessage = document.getElementById('error-message');
const themeSwitcher = document.getElementById('theme-switcher');
const locationDetector = document.getElementById('location-detector');
const locationText = document.getElementById('location-text');
const authModal = document.getElementById('auth-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const getStartedBtn = document.getElementById('get-started-btn');
const showSignup = document.getElementById('show-signup');
const showLogin = document.getElementById('show-login');
const loginView = document.getElementById('login-view');
const signupView = document.getElementById('signup-view');
const verificationView = document.getElementById('verification-view');
const userInfo = document.getElementById('user-info');
const usernameDisplay = document.getElementById('username-display');
const userPoints = document.getElementById('user-points');
const logoutBtn = document.getElementById('logout-btn');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const authError = document.getElementById('auth-error');
const moreImagesBtn = document.getElementById('more-images-btn');
const galleryModal = document.getElementById('gallery-modal');
const closeGalleryBtn = document.getElementById('close-gallery-btn');
const galleryContent = document.getElementById('gallery-content');
const subtitleText = document.getElementById('subtitle-text');
const homeLink = document.getElementById('home-link');

let map;
let userMarker;
let landmarkMarker;
let currentBase64Data = null;
let firestoreSavedPlaces = [];
let unsubscribePlaces;
let unsubscribeUser;

const themeIcon = themeSwitcher.querySelector('i');
themeSwitcher.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    updateThemeIcon();
});

locationDetector.addEventListener('click', () => {
    getUserLocation(true);
});

function resetUI() {
    uploadContainer.classList.remove('hidden');
    resultContainer.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

homeLink.addEventListener('click', (e) => {
    e.preventDefault();
    resetUI();
});

function updateThemeIcon() {
    if (document.documentElement.classList.contains('dark')) {
        themeIcon.classList.remove('fa-sun');
        themeIcon.classList.add('fa-moon');
    } else {
        themeIcon.classList.remove('fa-moon');
        themeIcon.classList.add('fa-sun');
    }
}

function showModal(view = 'login') {
    authModal.classList.remove('hidden');
    loginView.classList.toggle('hidden', view !== 'login');
    signupView.classList.toggle('hidden', view !== 'signup');
    verificationView.classList.toggle('hidden', view !== 'verify');
    authError.classList.add('hidden');
}

function hideModal() { authModal.classList.add('hidden'); }

getStartedBtn.addEventListener('click', () => showModal());
closeModalBtn.addEventListener('click', hideModal);
usernameDisplay.addEventListener('click', () => {
    renderGallery();
    galleryModal.classList.remove('hidden');
});
closeGalleryBtn.addEventListener('click', () => galleryModal.classList.add('hidden'));

showSignup.addEventListener('click', (e) => { e.preventDefault(); showModal('signup'); });
showLogin.addEventListener('click', (e) => { e.preventDefault(); showModal('login'); });

onAuthStateChanged(auth, user => {
    if (user && !user.isAnonymous && user.emailVerified) {
        userInfo.classList.remove('hidden');
        getStartedBtn.classList.add('hidden');
        usernameDisplay.textContent = user.displayName || 'User';
        subtitleText.textContent = 'Upload an image to identify a place, view it on the map, and learn its history. Click on your username to find your saved discoveries!';
        hideModal();
        attachUserListener(user.uid);
        attachPlacesListener(user.uid);
    } else {
        userInfo.classList.add('hidden');
        getStartedBtn.classList.remove('hidden');
        subtitleText.textContent = 'Upload an image to identify a place, view it on the map, and learn its history. Sign up to save your discoveries!';
        if (unsubscribePlaces) unsubscribePlaces();
        if (unsubscribeUser) unsubscribeUser();
        firestoreSavedPlaces = [];
    }
});

function attachUserListener(userId) {
    const userDocRef = doc(db, "artifacts", appId, "users", userId);
     unsubscribeUser = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
            const userData = doc.data();
            userPoints.textContent = userData.points || 0;
        }
    });
}

function attachPlacesListener(userId) {
    const placesColRef = collection(db, "artifacts", appId, "users", userId, "places");
    const q = query(placesColRef);
    unsubscribePlaces = onSnapshot(q, (snapshot) => {
        firestoreSavedPlaces = [];
        snapshot.forEach(doc => {
            firestoreSavedPlaces.push({ id: doc.id, ...doc.data() });
        });
    });
}

signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = signupForm['signup-username'].value;
    const email = signupForm['signup-email'].value;
    const password = signupForm['signup-password'].value;
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: username });
        await sendEmailVerification(userCredential.user);
        await setDoc(doc(db, "artifacts", appId, "users", userCredential.user.uid), { username, email, points: 0 });
        showModal('verify');
        signupForm.reset();
    } catch (error) {
        authError.textContent = error.message;
        authError.classList.remove('hidden');
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginForm['login-email'].value;
    const password = loginForm['login-password'].value;
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (!userCredential.user.emailVerified) {
            authError.textContent = "Please verify your email before logging in.";
            authError.classList.remove('hidden');
            signOut(auth);
        } else {
            loginForm.reset();
            hideModal();
        }
    } catch (error) {
        authError.textContent = error.message;
        authError.classList.remove('hidden');
    }
});


logoutBtn.addEventListener('click', () => { signOut(auth).then(() => { resetUI(); signInAnonymously(auth); }); });

function initMap(coords = [20.5937, 78.9629]) {
    if (map) { map.remove(); }
    map = L.map('map').setView(coords, 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
}

function getUserLocation(showOnMap = false) {
     if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const { latitude, longitude } = position.coords;
            if (showOnMap) {
                const userCoords = [latitude, longitude];
                if (!map) {
                    initMap(userCoords);
                    map.setView(userCoords, 15);
                } else {
                    map.setView(userCoords, 15);
                }
                if (userMarker) userMarker.remove();
                userMarker = L.marker(userCoords).addTo(map).bindPopup('Your Location').openPopup();
                setTimeout(() => map.invalidateSize(), 100);
            }
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
                .then(res => res.json()).then(data => {
                    const city = data.address.city || data.address.town || data.address.village || 'Unknown City';
                    const country = data.address.country || 'Unknown Country';
                    locationText.textContent = `${city}, ${country}`;
                }).catch(() => { locationText.textContent = "Location not found"; });
        }, () => { locationText.textContent = "Location access denied"; });
    } else { locationText.textContent = "Geolocation not supported"; }
}

uploadContainer.addEventListener('click', () => imageUpload.click());
uploadContainer.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); uploadContainer.classList.add('border-indigo-500'); });
uploadContainer.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); uploadContainer.classList.remove('border-indigo-500'); });
uploadContainer.addEventListener('drop', (e) => {
    e.preventDefault(); e.stopPropagation(); uploadContainer.classList.remove('border-indigo-500');
    if (e.dataTransfer.files.length) handleImage(e.dataTransfer.files[0]);
});
imageUpload.addEventListener('change', (e) => { if (e.target.files.length) handleImage(e.target.files[0]); });

function handleImage(file) {
    if (!file.type.startsWith('image/')) { showError('Please upload a valid image file.'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
        imagePreview.src = e.target.result;
        resultContainer.classList.remove('hidden');
        analyzeButton.classList.remove('hidden');
        uploadContainer.classList.add('hidden');
        mapAndInfo.classList.add('hidden');
        errorMessage.classList.add('hidden');
        currentBase64Data = e.target.result;
    };
    reader.readAsDataURL(file);
}

analyzeButton.addEventListener('click', () => {
    if (currentBase64Data) {
        analyzeButton.classList.add('hidden');
        analyzeImage(currentBase64Data.split(',')[1]);
    }
});

async function callGemini(prompt, base64Data) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`;
    const payload = { contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: base64Data } }] }] };
    try {
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) { const errorBody = await response.json(); throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorBody.error.message}`); }
        const result = await response.json();
        return result.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        showError(`Failed to analyze image. ${error.message}`);
        return null;
    }
}

async function analyzeImage(base64Data) {
    loader.classList.remove('hidden');
    const locationPrompt = "Identify the landmark in this image. Provide only a JSON object with 'name', 'latitude', and 'longitude'. Example: {\"name\": \"Eiffel Tower\", \"latitude\": 48.8584, \"longitude\": 2.2945}";
    const locationResponse = await callGemini(locationPrompt, base64Data);
    if (!locationResponse) { loader.classList.add('hidden'); resetUI(); return; }

    try {
        const locationData = JSON.parse(locationResponse.replace(/```json|```/g, '').trim());
        const { name, latitude, longitude } = locationData;
        if (!name || !latitude || !longitude) { throw new Error("Invalid data received from AI."); }
        
        const infoPrompt = `Provide a detailed, engaging description of the history, architecture, and significance of ${name}. Format it as clean HTML paragraphs.`;
        const infoResponse = await callGemini(infoPrompt, base64Data);
        const cleanedInfo = infoResponse ? infoResponse.replace(/```html|```/g, '').trim() : '<p>Could not retrieve detailed information for this location.</p>';

        const placeData = { name, latitude, longitude, info: cleanedInfo, imageUrl: currentBase64Data, createdAt: new Date() };

        displaySavedPlace(placeData);

        const user = auth.currentUser;
        if (user && !user.isAnonymous && user.emailVerified) {
            await addDoc(collection(db, "artifacts", appId, "users", user.uid, "places"), placeData);
            const userDocRef = doc(db, "artifacts", appId, "users", user.uid);
            await updateDoc(userDocRef, { points: increment(5) });
        } 
    } catch (e) {
        console.error("Error processing data:", e);
        showError("Could not identify the landmark or retrieve its details. The image might be unclear or not a known landmark.");
    } finally {
        loader.classList.add('hidden');
    }
}

function renderGallery() {
    galleryContent.innerHTML = '';
    const user = auth.currentUser;
    if (!user || user.isAnonymous || !user.emailVerified) {
        galleryContent.innerHTML = '<p class="col-span-full text-center text-gray-500">Please log in to see your saved places.</p>';
        return;
    }

    if (firestoreSavedPlaces.length === 0) {
        galleryContent.innerHTML = '<p class="col-span-full text-center text-gray-500">You haven\'t discovered any places yet. Upload an image to begin!</p>';
        return;
    }
    const sortedPlaces = [...firestoreSavedPlaces].sort((a, b) => {
        const dateA = a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return dateB - dateA;
    });
    sortedPlaces.forEach((place, index) => {
        const card = document.createElement('div');
        card.className = 'card rounded-xl shadow-lg overflow-hidden cursor-pointer';
        card.innerHTML = `<img src="${place.imageUrl}" alt="${place.name}" class="w-full h-48 object-cover"><div class="p-4"><h3 class="font-bold text-lg truncate">${place.name}</h3></div>`;
        card.addEventListener('click', () => {
            displaySavedPlace(place);
            galleryModal.classList.add('hidden');
        });
        galleryContent.appendChild(card);
    });
}

function displaySavedPlace(place) {
    uploadContainer.classList.add('hidden');
    resultContainer.classList.remove('hidden');
    mapAndInfo.classList.remove('hidden');
    loader.classList.add('hidden');
    errorMessage.classList.add('hidden');
    analyzeButton.classList.add('hidden');

    imagePreview.src = place.imageUrl;
    placeName.textContent = place.name;
    infoContent.innerHTML = place.info;
    moreImagesBtn.href = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(place.name)}`;
    const coords = [place.latitude, place.longitude];
    
    if (!map) initMap(coords);
    else map.setView(coords, 15);
    
    if (landmarkMarker) landmarkMarker.remove();
    landmarkMarker = L.marker(coords).addTo(map).bindPopup(place.name).openPopup();
    resultContainer.scrollIntoView({ behavior: 'smooth' });

    setTimeout(() => map.invalidateSize(), 100);
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    mapAndInfo.classList.add('hidden');
    analyzeButton.classList.remove('hidden');
}

async function handleAuth() {
    try {
        await signInAnonymously(auth);
    } catch (error) {
        console.error("Anonymous sign-in failed", error);
    }
}

window.onload = async () => {
    await handleAuth();
    initMap();
    updateThemeIcon();
    getUserLocation(false);
};
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';

import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';

import { environment } from './environments/environment';

import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';

import { provideRouter } from '@angular/router';
import { routes } from './app/app.routes';

bootstrapApplication(AppComponent, {
  providers: [
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
    provideHttpClient(withFetch()),
    provideAnimationsAsync(),
    providePrimeNG({
        theme: { preset: Aura, options: { darkModeSelector: '.p-dark' } },
    }),
    provideRouter(routes), provideFirebaseApp(() => initializeApp({ projectId: "taskmanagerapp-823a4", appId: "1:606917709405:web:6ca7df370b414bc84547b4", storageBucket: "taskmanagerapp-823a4.firebasestorage.app", apiKey: "AIzaSyA03dpeATNGJXiyfUINZ7dNuuiZRJV2894", authDomain: "taskmanagerapp-823a4.firebaseapp.com", messagingSenderId: "606917709405" })), provideAuth(() => getAuth())
  ]
}).catch(err => console.error(err));

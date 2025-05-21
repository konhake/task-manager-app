import { Injectable } from '@angular/core';
import { Auth, user, signInWithPopup, GoogleAuthProvider, signOut, User } from '@angular/fire/auth'; // Importe User para tipagem
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  // O Observable de user já está configurado para emitir o usuário autenticado ou null
  user$: Observable<User | null>; // Melhor tipagem para user Observable

  constructor(private auth: Auth) {
    this.user$ = user(this.auth);
  }

  async googleSignIn() {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(this.auth, provider);
      console.log('Login com Google bem-sucedido!');
    } catch (err) {
      console.error('Erro ao fazer login com Google:', err);
      // Você pode querer lançar o erro novamente ou retornar um valor para o componente
      throw err;
    }
  }

  async signOutUser() { // Renomeado para evitar conflito com a função global signOut
    try {
      await signOut(this.auth);
      console.log('Logout bem-sucedido!');
    } catch (err) {
      console.error('Erro ao fazer logout:', err);
      throw err;
    }
  }
}
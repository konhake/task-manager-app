import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc } from '@angular/fire/firestore';
import { Observable, of, from } from 'rxjs';
import { switchMap, take, map } from 'rxjs/operators'; // Adiciona 'map'
import { AuthService } from '../auth/auth.service'; // Ajusta o caminho se for diferente

// Interface para os dados como serão guardados no Firestore
// É mais simples que a tua 'AppTask', focada nos dados essenciais para persistência.
export interface FirestoreTask {
  id?: string; // O ID do documento no Firestore, será adicionado quando lido
  title: string;
  description: string;
  dueDate: Date; // Armazenado como Firebase Timestamp, mas queremos recebê-lo como Date
  priority: 'Urgente' | 'Normal' | 'Baixa';
  completed: boolean;
  createdAt?: Date; // Timestamp de criação no Firebase, será adicionado no serviço
}

export interface UserProfile {
  name: string;
  email: string;
  photoURL?: string;
  lastLogin: Date;
  // Adiciona quaisquer outros campos de perfil que queiras persistir
}

@Injectable({
  providedIn: 'root'
})
export class DataService {

  constructor(
    private firestore: Firestore,
    private authService: AuthService
  ) {}

  // --- Métodos para Perfil do Utilizador ---

  async updateUserData(uid: string, data: Partial<UserProfile>): Promise<void> {
    const userDocRef = doc(this.firestore, `users/${uid}`);
    // Use `setDoc` com `merge: true` para criar o documento se não existir,
    // ou apenas atualizar os campos fornecidos se já existir.
    return setDoc(userDocRef, { ...data, lastLogin: new Date() }, { merge: true });
  }

  getUserProfile(): Observable<UserProfile | undefined> {
    return this.authService.getCurrentUserUid().pipe(
      switchMap(uid => {
        if (uid) {
          const userDocRef = doc(this.firestore, `users/${uid}`);
          return from(getDoc(userDocRef)).pipe(
            map(snapshot => {
              if (snapshot.exists()) {
                const data = snapshot.data() as UserProfile;
                // Converte Timestamps para Date objects, se necessário (AngularFire já faz isso para collectionData, mas para getDoc pode ser diferente)
                return {
                  ...data,
                  lastLogin: (data.lastLogin as any)?.toDate ? (data.lastLogin as any).toDate() : data.lastLogin
                };
              }
              return undefined;
            })
          );
        } else {
          return of(undefined);
        }
      })
    );
  }

  // --- Métodos para Tarefas ---

  // Obtém todas as tarefas para o utilizador autenticado (em tempo real)
  getUserTasks(): Observable<FirestoreTask[]> {
    return this.authService.getCurrentUserUid().pipe(
      switchMap(uid => {
        if (uid) {
          const tasksCollectionRef = collection(this.firestore, `users/${uid}/tasks`);
          // collectionData com idField: 'id' adiciona o ID do documento ao objeto
          return collectionData(tasksCollectionRef, { idField: 'id' }).pipe(
            // Mapeia para garantir que dueDate e createdAt são objetos Date,
            // pois o Firestore Timestamp precisa de ser convertido.
            map(tasks => tasks.map(task => ({
              ...task,
              dueDate: (task['dueDate'] as any)?.toDate ? (task['dueDate'] as any).toDate() : task['dueDate'],
              createdAt: (task['createdAt'] as any)?.toDate ? (task['createdAt'] as any).toDate() : task['createdAt']
            } as FirestoreTask)))
          ) as Observable<FirestoreTask[]>;
        } else {
          return of([]); // Retorna um array vazio se não houver utilizador logado
        }
      })
    );
  }

  // Adiciona uma nova tarefa
  async addTask(task: Omit<FirestoreTask, 'id' | 'createdAt'>): Promise<any> {
    const uid = await this.authService.getCurrentUserUid().pipe(take(1)).toPromise();
    if (uid) {
      const tasksCollectionRef = collection(this.firestore, `users/${uid}/tasks`);
      // Ao adicionar, certifica-te que `dueDate` é um objeto Date para ser convertido para Timestamp
      return addDoc(tasksCollectionRef, {
        ...task,
        dueDate: new Date(task.dueDate),
        createdAt: new Date() // Adiciona o timestamp de criação
      });
    } else {
      throw new Error('Utilizador não autenticado. Não é possível adicionar tarefa.');
    }
  }

  // Atualiza uma tarefa existente
  async updateTask(task: FirestoreTask): Promise<void> {
    const uid = await this.authService.getCurrentUserUid().pipe(take(1)).toPromise();
    if (uid && task.id) {
      const taskDocRef = doc(this.firestore, `users/${uid}/tasks/${task.id}`);
      // Ao atualizar, certifica-te que `dueDate` é um objeto Date para ser convertido para Timestamp
      return updateDoc(taskDocRef, {
        ...task,
        dueDate: new Date(task.dueDate)
      });
    } else {
      throw new Error('Utilizador não autenticado ou ID da tarefa ausente. Não é possível atualizar.');
    }
  }

  // Elimina uma tarefa
  async deleteTask(taskId: string): Promise<void> {
    const uid = await this.authService.getCurrentUserUid().pipe(take(1)).toPromise();
    if (uid) {
      const taskDocRef = doc(this.firestore, `users/${uid}/tasks/${taskId}`);
      return deleteDoc(taskDocRef);
    } else {
      throw new Error('Utilizador não autenticado. Não é possível eliminar tarefa.');
    }
  }
}
// src/app/services/data.service.ts
import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, query, orderBy } from '@angular/fire/firestore';
import { Observable, of, from } from 'rxjs';
import { switchMap, take, map, tap } from 'rxjs/operators'; // Adicionado 'tap' para debugging
import { AuthService } from '../auth/auth.service'; // Ajusta o caminho se for diferente

export interface FirestoreTask {
  id?: string; // O ID do documento no Firestore, será adicionado quando lido
  title: string;
  description: string;
  dueDate: Date; // Armazenado como Firebase Timestamp, mas queremos recebê-lo como Date
  priority: 'Urgente' | 'Normal' | 'Baixa';
  completed: boolean;
  createdAt?: Date; // Timestamp de criação no Firebase, será adicionado no serviço
}

// Interface para a tarefa para uso na UI (AppTask)
export interface AppTask {
  id?: string; // Opcional, pois só existe após ser guardado no Firestore
  title: string;
  time: string; // Manter como string formatada para display (ex: "HH:MM")
  originalDateTime?: Date; // Para armazenar o objeto Date original para edição (o dueDate do Firestore)
  description?: string;
  priority?: 'Urgente' | 'Normal' | 'Baixa' | null;
  completed: boolean;
  isEditing: boolean; // Nova propriedade para controlar o modo de edição
  _originalTaskCopy?: AppTask; // Nova propriedade para armazenar uma cópia completa da tarefa antes da edição
  createdAt?: Date; // Data de criação da tarefa no Firestore
}

export interface UserProfile {
  name: string;
  email: string;
  photoURL?: string;
  lastLogin: Date;
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
    console.log(`[DataService] Atualizando perfil do usuário ${uid} com:`, data);
    return setDoc(userDocRef, { ...data, lastLogin: new Date() }, { merge: true })
      .catch(error => {
        console.error("[DataService] Erro ao atualizar perfil:", error);
        throw error;
      });
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
                // Firebase Timestamp para JS Date para lastLogin
                if (data.lastLogin && typeof data.lastLogin === 'object' && 'toDate' in data.lastLogin) {
                  data.lastLogin = (data.lastLogin as any).toDate();
                }
                console.log(`[DataService] Perfil do usuário ${uid} carregado:`, data);
                return data;
              } else {
                console.log(`[DataService] Perfil para ${uid} não encontrado.`);
                return undefined;
              }
            }),
            take(1) // Pega apenas o primeiro valor e completa
          );
        } else {
          console.log('[DataService] UID do usuário é nulo, retornando perfil indefinido.');
          return of(undefined);
        }
      })
    );
  }

  // --- Métodos para Tarefas ---

  getUserTasks(): Observable<FirestoreTask[]> {
    return this.authService.getCurrentUserUid().pipe(
      switchMap(uid => {
        if (uid) {
          const tasksCollectionRef = collection(this.firestore, `users/${uid}/tasks`);
          // Adicionado orderBy para garantir que as tarefas vêm ordenadas
          const q = query(tasksCollectionRef, orderBy('dueDate', 'asc')); 
          return collectionData(q, { idField: 'id' }).pipe(
            map(tasks => {
              const typedTasks = tasks as FirestoreTask[];
              console.log(`[DataService] Tarefas carregadas para ${uid}:`, typedTasks);
              return typedTasks;
            }),
            tap(tasks => console.log('[DataService] Tarefas após carregamento:', tasks)) // Para debugging
          );
        } else {
          console.log('[DataService] UID do usuário é nulo, retornando array de tarefas vazio.');
          return of([]); // Retorna um array vazio se o usuário não estiver logado
        }
      })
    );
  }

  async addTask(task: Omit<FirestoreTask, 'id'>): Promise<void> {
    const uid = await this.authService.getCurrentUserUid().pipe(take(1)).toPromise();
    if (!uid) {
      console.error('[DataService] Não é possível adicionar tarefa: Usuário não logado.');
      throw new Error('Usuário não autenticado.');
    }
    const tasksCollectionRef = collection(this.firestore, `users/${uid}/tasks`);
    const taskToAdd = { ...task, createdAt: new Date() }; // Adiciona timestamp de criação
    console.log('[DataService] Adicionando tarefa:', taskToAdd);
    return addDoc(tasksCollectionRef, taskToAdd)
      .then(() => console.log('[DataService] Tarefa adicionada com sucesso!'))
      .catch(error => {
        console.error('[DataService] Erro ao adicionar tarefa:', error);
        throw error;
      });
  }

  async updateTask(task: FirestoreTask): Promise<void> {
    const uid = await this.authService.getCurrentUserUid().pipe(take(1)).toPromise();
    if (!uid) {
      console.error('[DataService] Não é possível atualizar tarefa: Usuário não logado.');
      throw new Error('Usuário não autenticado.');
    }
    if (!task.id) {
      console.error('[DataService] Não é possível atualizar tarefa: ID da tarefa ausente.', task);
      throw new Error('ID da tarefa é obrigatório para atualização.');
    }
    const taskDocRef = doc(this.firestore, `users/${uid}/tasks/${task.id}`);
    const { id, ...dataToUpdate } = task; // Remove o ID do objeto antes de enviar para o Firestore
    console.log(`[DataService] Atualizando tarefa ${id} com:`, dataToUpdate);
    return updateDoc(taskDocRef, dataToUpdate)
      .then(() => console.log(`[DataService] Tarefa ${id} atualizada com sucesso!`))
      .catch(error => {
        console.error(`[DataService] Erro ao atualizar tarefa ${id}:`, error);
        throw error;
      });
  }

  async deleteTask(taskId: string): Promise<void> {
    const uid = await this.authService.getCurrentUserUid().pipe(take(1)).toPromise();
    if (!uid) {
      console.error('[DataService] Não é possível excluir tarefa: Usuário não logado.');
      throw new Error('Usuário não autenticado.');
    }
    const taskDocRef = doc(this.firestore, `users/${uid}/tasks/${taskId}`);
    console.log(`[DataService] Excluindo tarefa com ID: ${taskId}`);
    return deleteDoc(taskDocRef)
      .then(() => console.log(`[DataService] Tarefa ${taskId} excluída com sucesso!`))
      .catch(error => {
        console.error(`[DataService] Erro ao excluir tarefa ${taskId}:`, error);
        throw error;
      });
  }
}
import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common'; // Necessário para *ngIf, *ngFor
import { FormsModule } from '@angular/forms'; // Necessário para [(ngModel)]
import { RouterOutlet } from '@angular/router'; // Se usares rotas

// Importações dos módulos do PrimeNG (VERIFICA ESTES CAMINHOS E NOMES)
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea'; // Corrigido
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { TagModule } from 'primeng/tag';
import { TimelineModule } from 'primeng/timeline';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ProgressBarModule } from 'primeng/progressbar';
import { ToastModule } from 'primeng/toast'; // Para o p-toast
import { MessageService } from 'primeng/api'; // Para injetar o MessageService

// Firebase
import { Auth, GoogleAuthProvider, signInWithPopup, signOut, user, User } from '@angular/fire/auth';
import { Firestore, collection, addDoc, query, where, getDocs, deleteDoc, doc, updateDoc } from '@angular/fire/firestore';
import { Observable, Subscription, from } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';

// Tipagem para Tarefa
interface Task {
  id?: string;
  title: string;
  description: string;
  dateTime: Date;
  time: string; // Formato "HH:mm" para exibição
  priority: 'Urgente' | 'Normal' | 'Baixa';
  completed: boolean;
  userId: string;
  originalDateTime: Date; // Usado para edição no calendário
  isEditing?: boolean; // Para controlar o estado de edição na UI
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterOutlet, // Se usares rotas, mantém
    ButtonModule,
    CardModule,
    InputTextModule,
    TextareaModule, // Adicionado e corrigido
    DropdownModule,
    CalendarModule,
    TagModule,
    TimelineModule,
    ProgressSpinnerModule,
    ProgressBarModule,
    ToastModule // Adicionado para o p-toast
  ],
  providers: [MessageService], // Prover MessageService aqui para toasts
  template: `
    <p-toast></p-toast> <div class="main-container">
      <div class="topbar">
        <div class="topbar-content">
          <div class="branding">
            <i class="pi pi-check-square brand-icon"></i>
            <span>Gestor de Tarefas</span>
          </div>
          <div class="user-info" *ngIf="userLoggedIn; else loginSection">
            <img [src]="userPhotoUrl || 'assets/default-avatar.png'" alt="User Avatar" class="user-avatar" />
            <span class="user-name">{{ userName }}</span>
            <button pButton icon="pi pi-sign-out" label="Sair" (click)="logout()" class="p-button-danger p-button-sm"></button>
          </div>
          <ng-template #loginSection>
            <div class="login-prompt">
              <button pButton icon="pi pi-google" label="Login com Google" (click)="login()" class="p-button-success"></button>
            </div>
          </ng-template>
        </div>
      </div>

      <div class="content-wrapper" *ngIf="userLoggedIn && !isLoadingAuth">
        <p-progressSpinner *ngIf="isLoadingTasks" styleClass="w-4rem h-4rem" strokeWidth="8" animationDuration=".5s"></p-progressSpinner>

        <div class="app-layout" *ngIf="!isLoadingTasks">
          <div class="task-form-column p-fluid">
            <p-card header="Adicionar Nova Tarefa" class="mb-4">
              <div class="day-selector">
                <p-button *ngFor="let day of days; let i = index"
                          [label]="day"
                          [styleClass]="'p-button-outlined ' + (selectedDay === day ? 'p-button-success' : 'p-button-secondary')"
                          (click)="selectDay(day)">
                </p-button>
              </div>

              <div class="new-task-info">
                <span *ngIf="formattedNewTaskDateDisplay" class="p-text-bold">
                  <i class="pi pi-calendar p-mr-2"></i>
                  A adicionar tarefa para: {{ formattedNewTaskDateDisplay }}
                </span>
                <span *ngIf="!formattedNewTaskDateDisplay" class="p-text-italic">
                  Selecione um dia para adicionar uma tarefa.
                </span>
              </div>

              <div class="p-field">
                <label for="newTaskTitle">Título da Tarefa</label>
                <input id="newTaskTitle" type="text" pInputText [(ngModel)]="newTaskTitle" required />
              </div>
              <div class="p-field">
                <label for="newTaskDescription">Descrição (Opcional)</label>
                <textarea id="newTaskDescription" pInputTextarea [(ngModel)]="newTaskDescription" rows="3"></textarea>
              </div>

              <div class="p-field">
                <label for="taskDateTime">Data e Hora da Tarefa</label>
                <p-calendar
                    id="taskDateTime"
                    [(ngModel)]="newTaskDateTime"
                    [showTime]="true"
                    hourFormat="24"
                    dateFormat="dd/mm/yy"
                    [locale]="calendar_pt"
                    placeholder="Data e Hora da Tarefa"
                    [minDate]="today"
                    [appendTo]="'body'"
                    class="w-full"
                ></p-calendar>
              </div>

              <div class="p-field">
                <label for="newTaskPriority">Prioridade</label>
                <p-dropdown id="newTaskPriority" [(ngModel)]="newTaskPriority" [options]="priorityOptions" optionLabel="label" optionValue="value" placeholder="Selecione a Prioridade"></p-dropdown>
              </div>

              <button pButton type="button" label="Adicionar Tarefa" icon="pi pi-plus" (click)="addTask()" class="p-mt-3" [disabled]="!newTaskTitle || !newTaskDateTime"></button>
            </p-card>
          </div>

          <div class="task-timeline-column">
            <p-card [header]="'Tarefas para ' + selectedDay" class="mb-4">
              <div class="p-d-flex p-ai-center p-jc-between p-mb-3">
                <div class="p-text-lg p-text-bold">Progresso do Dia:</div>
                <div class="p-d-flex p-ai-center">
                  <p-progressBar [value]="(progressValue$ | async)!" styleClass="p-mr-2" [showValue]="true"></p-progressBar>
                </div>
              </div>

              <p-timeline [value]="currentTasks" align="alternate" layout="vertical" *ngIf="currentTasks.length > 0; else noTasks">
                <ng-template pTemplate="marker" let-task>
                    <span class="custom-marker" [class]="{
                        'priority-urgent': task.priority === 'Urgente',
                        'priority-normal': task.priority === 'Normal',
                        'priority-low': task.priority === 'Baixa',
                        'task-completed': task.completed
                    }">
                        <i [ngClass]="{
                          'pi pi-exclamation-triangle': task.priority === 'Urgente',
                          'pi pi-info-circle': task.priority === 'Normal',
                          'pi pi-arrow-down': task.priority === 'Baixa',
                          'pi pi-check-circle': task.completed
                        }"></i>
                    </span>
                </ng-template>
                <ng-template pTemplate="content" let-task>
                    <p-card class="p-mb-3 task-card" [class.task-completed]="task.completed">
                        <div class="p-d-flex p-jc-between p-ai-start">
                            <div class="p-flex-grow-1">
                                <h4 class="p-m-0 task-title" [class.line-through]="task.completed">{{ task.title }}</h4>
                                <p class="p-m-0 p-text-sm p-text-secondary">{{ task.time }}</p>
                            </div>
                            <div class="p-d-flex p-flex-column p-ai-end">
                                <span class="p-tag p-mb-2" [ngClass]="{
                                    'p-tag-danger': task.priority === 'Urgente',
                                    'p-tag-warning': task.priority === 'Normal',
                                    'p-tag-success': task.priority === 'Baixa'
                                }">{{ task.priority }}</span>
                                <div class="p-d-flex">
                                    <button pButton icon="pi pi-check" class="p-button-success p-button-text p-button-sm p-mr-1" (click)="completeTask(task)" [disabled]="task.completed"></button>
                                    <button pButton icon="pi pi-pencil" class="p-button-info p-button-text p-button-sm p-mr-1" (click)="editTask(task)" [disabled]="task.completed"></button>
                                    <button pButton icon="pi pi-times" class="p-button-danger p-button-text p-button-sm" (click)="removeTask(task)"></button>
                                </div>
                            </div>
                        </div>
                        <p class="p-mt-2 task-description" *ngIf="!task.isEditing">{{ task.description }}</p>

                        <div *ngIf="task.isEditing" class="p-mt-3">
                            <div class="p-field">
                                <label for="editTitle">Título</label>
                                <input id="editTitle" type="text" pInputText [(ngModel)]="task.title" />
                            </div>
                            <div class="p-field">
                                <label for="editDescription">Descrição</label>
                                <textarea id="editDescription" pInputTextarea [(ngModel)]="task.description" rows="2"></textarea>
                            </div>
                            <div class="p-field">
                                <label for="editPriority">Prioridade</label>
                                <p-dropdown id="editPriority" [(ngModel)]="task.priority" [options]="priorityOptions" optionLabel="label" optionValue="value"></p-dropdown>
                            </div>
                             <div class="p-field">
                                <label for="editDateTime">Data e Hora</label>
                                <p-calendar
                                    id="editDateTime"
                                    [(ngModel)]="task.originalDateTime"
                                    [showTime]="true"
                                    hourFormat="24"
                                    dateFormat="dd/mm/yy"
                                    [locale]="calendar_pt"
                                    [appendTo]="'body'"
                                    class="w-full"
                                ></p-calendar>
                            </div>
                            <div class="p-d-flex p-jc-end p-mt-2">
                                <button pButton label="Cancelar" icon="pi pi-ban" class="p-button-secondary p-button-sm p-mr-2" (click)="cancelEdit(task)"></button>
                                <button pButton label="Salvar" icon="pi pi-save" class="p-button-success p-button-sm" (click)="saveTask(task)"></button>
                            </div>
                        </div>
                    </p-card>
                </ng-template>
              </p-timeline>
              <ng-template #noTasks>
                <p class="no-tasks">Nenhuma tarefa para {{ selectedDay }} ainda.</p>
              </ng-template>
            </p-card>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* app.component.scss */

    /* *************************************************************************************************** */
    /* ** IMPORTANTE: As importações de bibliotecas PrimeNG/PrimeFlex devem estar no angular.json, NÃO AQUI. ** */
    /* ** Certifica-te que NÃO tens linhas @import 'node_modules/...' ou '@import 'primeflex/...';' neste ficheiro. ** */
    /* *************************************************************************************************** */

    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      background-color: var(--surface-ground, #f8f9fa); /* Fallback para cores */
      font-family: var(--font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol");
      color: var(--text-color, #495057);
    }

    .main-container {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    .topbar {
      background-color: var(--primary-color, #1976D2);
      color: var(--primary-color-text, #ffffff);
      padding: 1rem 2rem;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      position: sticky;
      top: 0;
      z-index: 1000;
      width: 100%;
      box-sizing: border-box;
    }

    .topbar-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      max-width: 1200px;
    }

    .branding {
      display: flex;
      align-items: center;
      font-size: 1.5rem;
      font-weight: bold;
    }

    .brand-icon {
      margin-right: 0.5rem;
      font-size: 1.8rem;
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .user-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      margin-right: 0.75rem;
      border: 2px solid var(--primary-color-text, #ffffff);
      object-fit: cover;
    }

    .user-name {
      font-weight: 500;
      white-space: nowrap;
    }

    .content-wrapper {
      flex-grow: 1;
      padding: 1rem; /* Padding base para mobile */
      display: flex;
      justify-content: center;
      box-sizing: border-box;
    }

    /* CSS Grid para o layout principal */
    .app-layout {
      display: grid;
      width: 100%;
      max-width: 1200px;
      gap: 1.5rem; /* Espaço entre as colunas, ajustado para mobile */

      /* Layout padrão para mobile (uma coluna) */
      grid-template-columns: 1fr; /* Uma única coluna que ocupa todo o espaço disponível */
      grid-template-areas:
        "form"
        "timeline";

      .task-form-column {
        grid-area: form;
      }

      .task-timeline-column {
        grid-area: timeline;
      }
    }

    /* Media Query para telas maiores (desktops) - md breakpoint do PrimeFlex (~992px) */
    @media screen and (min-width: 992px) {
      .content-wrapper {
        padding: 2rem; /* Mais padding para desktop */
      }

      .app-layout {
        /* Duas colunas para desktop: 4/12 para o formulário e 8/12 para a timeline */
        grid-template-columns: 1fr 2fr; /* Ou 1fr para a esquerda e 2fr para a direita (aproximadamente 33%/66%) */
        grid-template-areas: "form timeline";
        gap: 2rem; /* Mais espaço entre as colunas para desktop */
      }
    }


    p-card {
      height: 100%;
      border-radius: var(--border-radius, 6px);
      overflow: hidden;
      box-shadow: var(--card-shadow, 0 2px 4px rgba(0,0,0,0.1));

      .p-card-body {
        padding: 1.5rem !important;
      }
      .p-card-content {
        padding-top: 0 !important;
      }
      .p-card-header {
        padding: 1rem 1.5rem;
        font-size: 1.25rem;
        font-weight: 700;
        background-color: var(--surface-card, #ffffff);
        border-bottom: 1px solid var(--surface-border, #dee2e6);
      }
    }

    .day-selector {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      margin-bottom: 1.5rem;
      gap: 0.75rem;
    }

    .p-button-outlined {
      padding: 0.6rem 1.2rem;
      font-size: 0.9rem;
      border-radius: var(--border-radius, 6px);
      transition: all 0.2s ease-in-out;
      border: 1px solid;
      
      &.p-button-success {
        background-color: var(--green-50, #e8f5e9);
        color: var(--green-700, #388e3c);
        border-color: var(--green-400, #66bb6a);
        &:hover {
          background-color: var(--green-100, #d0f8d0);
        }
      }
      &.p-button-secondary {
        background-color: var(--surface-100, #f1f3f5);
        color: var(--text-color-secondary, #6c757d);
        border-color: var(--surface-border, #dee2e6);
        &:hover {
          background-color: var(--surface-200, #e9ecef);
        }
      }
      &:focus {
        box-shadow: 0 0 0 0.2rem var(--primary-color-lighter, rgba(63, 81, 181, 0.2));
      }
    }

    .new-task-info {
      background-color: var(--blue-50, #e3f2fd);
      color: var(--blue-700, #1976D2);
      padding: 0.85rem 1.25rem;
      border-radius: var(--border-radius, 6px);
      border: 1px solid var(--blue-200, #90CAF9);
      margin-top: 1rem;
      margin-bottom: 2rem;
      font-size: 1rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;

      .pi {
        font-size: 1.2rem;
        color: var(--blue-600, #2196F3);
      }
    }

    .p-field {
      margin-bottom: 1.5rem;
    }

    .p-field label {
      display: block;
      margin-bottom: 0.6rem;
      font-weight: 600;
      color: var(--text-color, #495057);
      font-size: 0.95rem;
    }

    p-inputtext,
    p-inputtextarea,
    p-dropdown,
    p-calendar {
      width: 100%;
      .p-inputtext, .p-inputtextarea {
        padding: 0.75rem 0.75rem;
      }
      .p-inputtextarea {
        min-height: 4rem;
        resize: vertical;
      }
    }

    /* Estilos para a Timeline de Tarefas */
    p-timeline {
      width: 100%;
      padding-left: 1.5rem; /* Ajuste para centralizar um pouco o marcador na timeline mobile */
      padding-right: 1.5rem;

      .p-timeline-event {
        margin-bottom: 1.5rem;
        display: flex;
        align-items: stretch;
        position: relative;
        /* Ajuste inicial para mobile, empurra o conteúdo para a direita */
        flex-direction: row;
        justify-content: flex-start; /* Conteúdo sempre à direita do marcador */
      }

      .p-timeline-event-opposite {
        /* No mobile, o 'opposite' pode ser escondido ou ter largura mínima */
        display: none; /* Esconde o lado oposto no mobile para poupar espaço */
        flex: 0;
        padding: 0;
      }

      .p-timeline-event-content {
        flex: 1;
        padding: 0 0 0 1rem; /* Conteúdo sempre à direita do marcador */
        text-align: left; /* Alinha o texto à esquerda */
      }

      .p-timeline-event-separator {
        margin: 0; /* Remove margem */
        flex-shrink: 0;
        /* Centraliza o marcador na linha */
        align-self: center;
        position: absolute;
        left: 0; /* Alinha à esquerda da p-timeline */
        transform: translateX(-50%); /* Move 50% para trás para centralizar o marcador */
        z-index: 2;
      }

      /* Media Query para desktop (timeline alternada) */
      @media screen and (min-width: 768px) { /* Usar um breakpoint menor para a timeline */
        padding-left: 0; /* Remove padding extra para desktop */
        padding-right: 0;

        &.p-timeline-alternate {
          .p-timeline-event {
            justify-content: center; /* Permite alternar os lados */

            .p-timeline-event-opposite {
              display: block; /* Mostra o lado oposto no desktop */
              flex: 1;
              padding: 0 1rem;
            }

            .p-timeline-event-content {
              flex: 1;
              padding: 0 1rem;
            }

            .p-timeline-event-separator {
              position: relative; /* Volta ao fluxo normal */
              left: auto;
              transform: none;
              margin: 0 1rem; /* Espaço ao redor do separador */
            }

            &:nth-child(even) { /* Eventos pares (direita) */
              flex-direction: row-reverse;
              .p-timeline-event-opposite { text-align: left; }
              .p-timeline-event-content { text-align: right; }
            }
            &:nth-child(odd) { /* Eventos ímpares (esquerda) */
              flex-direction: row;
              .p-timeline-event-opposite { text-align: right; }
              .p-timeline-event-content { text-align: left; }
            }
          }
        }
      }

      .custom-marker {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 50%;
        z-index: 2;
        color: var(--surface-card, #ffffff);
        box-shadow: 0 0 0 3px var(--surface-card, #ffffff), 0 2px 5px rgba(0,0,0,0.2);
        flex-shrink: 0;
        
        i {
          font-size: 1.3rem;
        }

        &.priority-urgent { background-color: var(--red-500, #ef4444); }
        &.priority-normal { background-color: var(--orange-500, #f97316); }
        &.priority-low { background-color: var(--green-500, #22c55e); }
        &.task-completed { background-color: var(--green-700, #15803d); }
      }

      .task-card {
        background-color: var(--surface-card, #ffffff);
        border: 1px solid var(--surface-border, #e0e0e0);
        border-radius: var(--border-radius, 6px);
        box-shadow: var(--card-shadow, 0 1px 3px rgba(0,0,0,0.1));
        padding: 1.25rem;
        width: 100%;
        box-sizing: border-box;

        &.task-completed {
            opacity: 0.8;
            background-color: var(--surface-100, #f5f5f5);
            .task-title, .task-description {
                color: var(--text-color-secondary, #757575);
            }
        }

        .task-title {
            color: var(--text-color, #495057);
            font-size: 1.15rem;
            margin-bottom: 0.25rem;
        }

        .line-through {
            text-decoration: line-through;
        }

        .p-text-sm {
            font-size: 0.85rem;
            margin-bottom: 0.75rem;
        }

        .task-description {
            margin-top: 0.75rem;
            font-size: 0.95rem;
            color: var(--text-color, #495057);
            line-height: 1.4;
        }

        .p-tag {
            font-size: 0.75rem;
            padding: 0.25rem 0.6rem;
            border-radius: 0.25rem;
        }

        .p-d-flex {
          &.p-jc-between {
            margin-bottom: 0.75rem;
          }
        }

        .p-button-sm {
          padding: 0.4rem;
          font-size: 0.8rem;
          min-width: 2rem;
          height: 2rem;
        }

        .p-field {
          margin-bottom: 1rem;
          label {
            margin-bottom: 0.4rem;
            font-size: 0.9rem;
          }
          p-inputtext, p-textarea, p-dropdown, p-calendar {
            .p-inputtext, .p-inputtextarea {
                padding: 0.6rem 0.75rem;
            }
          }
        }
      }
    }

    /* PrimeNG ProgressBar Customization */
    p-progressbar {
      width: 180px;
      height: 20px;
      border-radius: 10px;
      background-color: var(--surface-200, #e9ecef);

      .p-progressbar-value {
        background-color: var(--green-500, #22c55e);
        border-radius: 10px;
      }
      .p-progressbar-label {
        color: var(--surface-card, #ffffff);
        font-weight: 700;
        font-size: 0.85rem;
      }
    }

    /* No tasks message */
    .no-tasks {
        text-align: center;
        padding: 3rem;
        color: var(--text-color-secondary, #6c757d);
        font-size: 1.1rem;
        font-style: italic;
    }

    /* Utilidades PrimeFlex (mantidas para compatibilidade, mas o layout principal usa grid) */
    .p-mr-2 { margin-right: 0.5rem !important; }
    .p-mb-2 { margin-bottom: 0.5rem !important; }
    .p-mr-1 { margin-right: 0.25rem !important; }
    .p-mt-3 { margin-top: 1rem !important; }
    .p-mb-3 { margin-bottom: 1rem !important; }
    .p-mb-4 { margin-bottom: 1.5rem !important; }
    .p-d-flex { display: flex !important; }
    .p-jc-center { justify-content: center !important; }
    .p-ai-center { align-items: center !important; }
    .p-jc-between { justify-content: space-between !important; }
    .p-ai-start { align-items: flex-start !important; }
    .p-flex-column { flex-direction: column !important; }
    .p-ai-end { align-items: flex-end !important; }
    .p-flex-grow-1 { flex-grow: 1 !important; }
    .p-text-center { text-align: center !important; }
    .p-text-bold { font-weight: bold !important; }
    .p-text-sm { font-size: 0.875rem !important; }
    .p-text-lg { font-size: 1.125rem !important; }
    .p-text-secondary { color: var(--text-color-secondary) !important; }
    .p-text-italic { font-style: italic !important; }
    .p-m-0 { margin: 0 !important; }
    .w-full { width: 100% !important; }

    /* Cores de prioridade para os tags */
    .p-tag-danger { background-color: var(--red-500, #ef4444); color: var(--red-50, #fef2f2); }
    .p-tag-warning { background-color: var(--orange-500, #f97316); color: var(--orange-50, #fff7ed); }
    .p-tag-success { background-color: var(--green-500, #22c55e); color: var(--green-50, #f0fdf4); }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  // Angular Services
  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);
  private messageService: MessageService = inject(MessageService); // Injeção do MessageService

  // User State
  userLoggedIn: boolean = false;
  userName: string = 'Convidado';
  userPhotoUrl: string | null = null;
  userId: string | null = null;
  private userSubscription: Subscription | null = null;
  isLoadingAuth: boolean = true;

  // Task Management
  days: string[] = ['Hoje', 'Amanhã', 'Próximos 7 Dias'];
  selectedDay: string = 'Hoje';
  currentTasks: Task[] = [];
  allTasks: Task[] = []; // Para armazenar todas as tarefas do utilizador
  isLoadingTasks: boolean = false;

  // New Task Form
  newTaskTitle: string = '';
  newTaskDescription: string = '';
  newTaskDateTime: Date | null = null;
  newTaskPriority: 'Urgente' | 'Normal' | 'Baixa' = 'Normal';
  priorityOptions = [
    { label: 'Urgente', value: 'Urgente' },
    { label: 'Normal', value: 'Normal' },
    { label: 'Baixa', value: 'Baixa' }
  ];
  today: Date = new Date();

  // Calendar Localization (Portuguese)
  calendar_pt = {
    firstDayOfWeek: 0,
    dayNames: ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"],
    dayNamesShort: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
    dayNamesMin: ["Do", "Se", "Te", "Qu", "Qu", "Se", "Sa"],
    monthNames: ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"],
    monthNamesShort: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
    today: 'Hoje',
    clear: 'Limpar',
    dateFormat: 'dd/mm/yy',
    weekHeader: 'Sem'
  };

  // Progress Bar
  progressValue$: Observable<number>;

  constructor() {
    this.progressValue$ = new Observable<number>(observer => {
      this.updateProgressBar(observer);
    });
  }

  ngOnInit(): void {
    this.userSubscription = user(this.auth).subscribe(firebaseUser => {
      if (firebaseUser) {
        this.userLoggedIn = true;
        this.userName = firebaseUser.displayName || firebaseUser.email || 'Utilizador';
        this.userPhotoUrl = firebaseUser.photoURL;
        this.userId = firebaseUser.uid;
        this.isLoadingAuth = false;
        this.fetchTasks();
      } else {
        this.userLoggedIn = false;
        this.userName = 'Convidado';
        this.userPhotoUrl = null;
        this.userId = null;
        this.isLoadingAuth = false;
        this.currentTasks = [];
        this.allTasks = [];
        this.updateProgressBar();
      }
    });
    this.selectDay('Hoje');
  }

  ngOnDestroy(): void {
    this.userSubscription?.unsubscribe();
  }

  // --- Autenticação ---
  async login(): Promise<void> {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(this.auth, provider);
      this.messageService.add({severity:'success', summary: 'Sucesso', detail: 'Login realizado com sucesso!'});
    } catch (error: any) {
      this.messageService.add({severity:'error', summary: 'Erro', detail: `Falha no login: ${error.message}`});
      console.error("Erro no login:", error);
    }
  }

  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
      this.messageService.add({severity:'info', summary: 'Desconectado', detail: 'Sessão encerrada.'});
    } catch (error: any) {
      this.messageService.add({severity:'error', summary: 'Erro', detail: `Falha ao sair: ${error.message}`});
      console.error("Erro ao sair:", error);
    }
  }

  // --- Gestão de Tarefas ---
  async fetchTasks(): Promise<void> {
    if (!this.userId) {
      this.currentTasks = [];
      this.allTasks = [];
      this.updateProgressBar();
      return;
    }

    this.isLoadingTasks = true;
    try {
      const q = query(collection(this.firestore, 'tasks'), where('userId', '==', this.userId));
      const querySnapshot = await getDocs(q);
      const tasks: Task[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const task: Task = {
          id: doc.id,
          title: data['title'],
          description: data['description'],
          dateTime: data['dateTime'] ? new Date(data['dateTime'].seconds * 1000) : new Date(),
          time: data['time'],
          priority: data['priority'],
          completed: data['completed'] || false,
          userId: data['userId'],
          originalDateTime: data['dateTime'] ? new Date(data['dateTime'].seconds * 1000) : new Date(),
        };
        tasks.push(task);
      });
      this.allTasks = tasks.sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime()); // Ordena por data
      this.filterTasksBySelectedDay();
      this.messageService.add({severity:'success', summary: 'Sucesso', detail: 'Tarefas carregadas!'});
    } catch (error: any) {
      this.messageService.add({severity:'error', summary: 'Erro', detail: `Falha ao carregar tarefas: ${error.message}`});
      console.error("Erro ao carregar tarefas:", error);
    } finally {
      this.isLoadingTasks = false;
    }
  }

  async addTask(): Promise<void> {
    if (!this.newTaskTitle || !this.newTaskDateTime || !this.userId) {
      this.messageService.add({severity:'warn', summary: 'Atenção', detail: 'Preencha o título e a data/hora da tarefa.'});
      return;
    }

    const taskTime = this.newTaskDateTime.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    const newTask: Task = {
      title: this.newTaskTitle,
      description: this.newTaskDescription,
      dateTime: this.newTaskDateTime,
      time: taskTime,
      priority: this.newTaskPriority,
      completed: false,
      userId: this.userId,
      originalDateTime: this.newTaskDateTime
    };

    try {
      const docRef = await addDoc(collection(this.firestore, 'tasks'), newTask);
      newTask.id = docRef.id;
      this.allTasks.push(newTask);
      this.allTasks.sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime()); // Re-ordena
      this.filterTasksBySelectedDay();
      this.resetNewTaskForm();
      this.messageService.add({severity:'success', summary: 'Sucesso', detail: 'Tarefa adicionada!'});
    } catch (error: any) {
      this.messageService.add({severity:'error', summary: 'Erro', detail: `Falha ao adicionar tarefa: ${error.message}`});
      console.error("Erro ao adicionar tarefa:", error);
    }
  }

  async completeTask(task: Task): Promise<void> {
    if (!task.id) return;
    try {
      const taskRef = doc(this.firestore, 'tasks', task.id);
      await updateDoc(taskRef, { completed: !task.completed });
      task.completed = !task.completed; // Atualiza localmente
      this.updateProgressBar(); // Recalcula o progresso
      this.messageService.add({severity:'success', summary: 'Sucesso', detail: `Tarefa ${task.completed ? 'concluída' : 'reaberta'}!`});
    } catch (error: any) {
      this.messageService.add({severity:'error', summary: 'Erro', detail: `Falha ao atualizar tarefa: ${error.message}`});
      console.error("Erro ao concluir tarefa:", error);
    }
  }

  editTask(task: Task): void {
    task.isEditing = true;
    // Cria uma cópia da data original para que as alterações no calendário não afetem a tarefa antes de salvar
    task.originalDateTime = task.dateTime ? new Date(task.dateTime.getTime()) : new Date();
  }

  cancelEdit(task: Task): void {
    task.isEditing = false;
    // Se precisares reverter os valores, podes guardar uma cópia antes de editar
    // Para simplificar, estamos apenas a fechar o formulário de edição
    this.fetchTasks(); // Para garantir que os dados revertam se algo foi alterado sem salvar
  }

  async saveTask(task: Task): Promise<void> {
    if (!task.id) return;

    // Atualiza o tempo formatado se a data/hora for alterada
    task.time = task.originalDateTime ? task.originalDateTime.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '';
    task.dateTime = task.originalDateTime || new Date(); // Garante que dateTime é atualizado

    try {
      const taskRef = doc(this.firestore, 'tasks', task.id);
      await updateDoc(taskRef, {
        title: task.title,
        description: task.description,
        priority: task.priority,
        dateTime: task.dateTime, // Salva a data como timestamp do Firebase
        time: task.time // Salva o tempo formatado
      });
      task.isEditing = false; // Sai do modo de edição
      this.allTasks.sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime()); // Re-ordena
      this.filterTasksBySelectedDay(); // Re-filtra e atualiza
      this.messageService.add({severity:'success', summary: 'Sucesso', detail: 'Tarefa atualizada!'});
    } catch (error: any) {
      this.messageService.add({severity:'error', summary: 'Erro', detail: `Falha ao salvar tarefa: ${error.message}`});
      console.error("Erro ao salvar tarefa:", error);
    }
  }

  async removeTask(task: Task): Promise<void> {
    if (!task.id) return;
    try {
      await deleteDoc(doc(this.firestore, 'tasks', task.id));
      this.allTasks = this.allTasks.filter(t => t.id !== task.id); // Remove localmente
      this.filterTasksBySelectedDay(); // Re-filtra e atualiza
      this.messageService.add({severity:'success', summary: 'Sucesso', detail: 'Tarefa removida!'});
    } catch (error: any) {
      this.messageService.add({severity:'error', summary: 'Erro', detail: `Falha ao remover tarefa: ${error.message}`});
      console.error("Erro ao remover tarefa:", error);
    }
  }

  // --- Filtros e Seleção de Dia ---
  selectDay(day: string): void {
    this.selectedDay = day;
    this.filterTasksBySelectedDay();
    this.resetNewTaskForm(); // Limpa o formulário quando o dia muda
  }

  filterTasksBySelectedDay(): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Zera hora para comparação de datas

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(today.getDate() + 7);

    this.currentTasks = this.allTasks.filter(task => {
      const taskDate = new Date(task.dateTime);
      taskDate.setHours(0, 0, 0, 0);

      switch (this.selectedDay) {
        case 'Hoje':
          return taskDate.getTime() === today.getTime();
        case 'Amanhã':
          return taskDate.getTime() === tomorrow.getTime();
        case 'Próximos 7 Dias':
          return taskDate.getTime() >= today.getTime() && taskDate.getTime() <= sevenDaysLater.getTime();
        default:
          return true; // Mostrar todas as tarefas se nenhum filtro for selecionado
      }
    });

    this.updateProgressBar();
  }

  // --- Utilitários ---
  resetNewTaskForm(): void {
    this.newTaskTitle = '';
    this.newTaskDescription = '';
    this.newTaskDateTime = null;
    this.newTaskPriority = 'Normal';
  }

  get formattedNewTaskDateDisplay(): string {
    if (!this.newTaskDateTime) {
      // Se não houver data selecionada, tenta usar o dia selecionado
      const today = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(today.getDate() + 1);
      const sevenDaysLater = new Date();
      sevenDaysLater.setDate(today.getDate() + 7);

      switch (this.selectedDay) {
        case 'Hoje':
          return today.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
        case 'Amanhã':
          return tomorrow.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
        case 'Próximos 7 Dias':
          return `De ${today.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })} a ${sevenDaysLater.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit'})}`;
        default:
          return '';
      }
    }
    return this.newTaskDateTime.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  updateProgressBar(observer?: any): void {
    if (this.currentTasks.length === 0) {
      if (observer) observer.next(0);
      return;
    }
    const completedTasks = this.currentTasks.filter(task => task.completed).length;
    const progress = (completedTasks / this.currentTasks.length) * 100;
    if (observer) observer.next(Math.round(progress));
    else this.progressValue$ = new Observable<number>(obs => obs.next(Math.round(progress)));
  }
}
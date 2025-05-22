// app.component.ts
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common'; // Necessário para *ngIf, *ngFor
import { FormsModule } from '@angular/forms'; // Necessário para [(ngModel)]
import { RouterOutlet } from '@angular/router'; // Se usares rotas

// Importações dos módulos do PrimeNG
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

// Angular CDK
import { CdkDragDrop, moveItemInArray, DragDropModule } from '@angular/cdk/drag-drop'; // <<-- ESTA IMPORTAÇÃO É CRUCIAL

// Firebase
import { Auth, GoogleAuthProvider, signInWithPopup, signOut, user, User } from '@angular/fire/auth';
import { Firestore, collection, addDoc, query, where, getDocs, deleteDoc, doc, updateDoc, writeBatch } from '@angular/fire/firestore';
import { Observable, Subscription } from 'rxjs';

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
  orderIndex: number; // <<-- ADICIONA ESTA PROPRIEDADE PARA ORDENAÇÃO
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
    TextareaModule,
    DropdownModule,
    CalendarModule,
    TagModule,
    TimelineModule,
    ProgressSpinnerModule,
    ProgressBarModule,
    ToastModule, // Adicionado para o p-toast
    DragDropModule // <<-- ADICIONA ESTA LINHA
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

              <div class="timeline-container" *ngIf="currentTasks.length > 0; else noTasks">
                <div cdkDropList (cdkDrop)="drop($event)" class="task-list-drop-area">
                  <p-timeline [value]="currentTasks" align="alternate" layout="vertical">
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
                    <ng-template pTemplate="content" let-task let-i="index">
                        <div class="task-item-wrapper" [class.task-completed]="task.completed" cdkDrag>
                            <div class="cdk-drag-handle" cdkDragHandle>
                              <i class="pi pi-bars"></i>
                            </div>

                            <div class="p-d-flex p-jc-between p-ai-start">
                                <div class="p-flex-grow-1">
                                    <h4 class="p-m-0 task-title" [class.line-through]="task.completed">{{ task.title }}</h4>
                                    <p class="p-m-0 p-text-sm p-text-secondary">{{ task.time }}</p>
                                </div>
                                <div class="action-buttons">
                                    <button pButton icon="pi pi-arrow-up" class="p-button-secondary p-button-text p-button-sm"
                                            (click)="moveTaskUp(task)"
                                            [disabled]="i === 0"></button>
                                    <button pButton icon="pi pi-arrow-down" class="p-button-secondary p-button-text p-button-sm"
                                            (click)="moveTaskDown(task)"
                                            [disabled]="i === currentTasks.length - 1"></button>

                                    <button pButton icon="pi pi-check" class="p-button-success p-button-text p-button-sm p-mr-1" (click)="completeTask(task)" [disabled]="task.completed"></button>
                                    <button pButton icon="pi pi-pencil" class="p-button-info p-button-text p-button-sm p-mr-1" (click)="editTask(task)" [disabled]="task.completed"></button>
                                    <button pButton icon="pi pi-times" class="p-button-danger p-button-text p-button-sm" (click)="removeTask(task)"></button>
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
                        </div>
                    </ng-template>
                  </p-timeline>
                </div>
              </div>
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
      box-shadow: var(--card-shadow, 0 2px 4px rgba(0, 0, 0, 0.1));

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
      padding: 0 0.5rem; /* Reduz o padding lateral para começar */
      
      .p-timeline-event {
        margin-bottom: 1.5rem;
        display: flex;
        align-items: stretch;
        position: relative;
        flex-direction: row;
        justify-content: flex-start;
      }

      .p-timeline-event-opposite {
        display: none;
        flex: 0;
        padding: 0;
      }

      .p-timeline-event-content {
        flex: 1;
        padding: 0 0 0 1.5rem; /* Mais espaço entre o marcador e o conteúdo */
        text-align: left;
        min-width: 0;
      }

      .p-timeline-event-separator {
        margin: 0;
        flex-shrink: 0;
        align-self: center;
        position: absolute;
        left: 0;
        transform: translateX(-50%);
        z-index: 2;
      }

      @media screen and (min-width: 768px) {
        padding: 0;

        &.p-timeline-alternate {
          .p-timeline-event {
            justify-content: center;

            .p-timeline-event-opposite {
              display: block;
              flex: 1;
              padding: 0 1rem;
            }

            .p-timeline-event-content {
              flex: 1;
              padding: 0 1rem;
            }

            .p-timeline-event-separator {
              position: relative;
              left: auto;
              transform: none;
              margin: 0 1rem;
            }

            &:nth-child(even) {
              flex-direction: row-reverse;
              .p-timeline-event-opposite { text-align: left; }
              .p-timeline-event-content { text-align: right; }
            }
            &:nth-child(odd) {
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
    }

    /* NOVO: Estilo para a área de drop principal */
    .task-list-drop-area {
      display: block; /* Essencial para o CDK Drag and Drop funcionar como uma lista */
      width: 100%;
    }

    /* NOVO: Estilo para o item de tarefa (substitui p-card e é o cdkDrag) */
    .task-item-wrapper {
      background-color: var(--surface-card, #ffffff);
      border: 1px solid var(--surface-border, #e0e0e0);
      border-radius: var(--border-radius, 6px);
      box-shadow: var(--card-shadow, 0 1px 3px rgba(0,0,0,0.1));
      padding: 1.25rem;
      width: 100%;
      box-sizing: border-box;
      min-width: 200px;
      max-width: 350px; /* Para desktop */
      position: relative; /* Para o handle de drag */

      &:active {
        cursor: grabbing;
      }

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
          word-break: break-word;
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
          flex-wrap: wrap;
          justify-content: flex-start;
          margin-bottom: 0.75rem;
        }
      }

      .action-buttons {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          margin-left: auto;
          gap: 0.5rem;
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

      .cdk-drag-handle {
        position: absolute;
        top: 0.5rem;
        left: 0.5rem;
        cursor: grab;
        color: var(--text-color-secondary, #6c757d);
        z-index: 10;
        padding: 0.2rem;
        border-radius: var(--border-radius);
        transition: background-color 0.2s;

        &:hover {
          background-color: var(--surface-100, #f1f3f5);
        }
        i {
          font-size: 1rem;
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
  
    /* Estilos para o Drag and Drop do Angular CDK */
    .cdk-drag-placeholder {
      opacity: 0.5;
      border: 2px dashed var(--primary-color, #1976D2);
      background-color: var(--surface-hover, #e0e0e0);
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
      box-sizing: border-box;
      width: 100%;
      height: auto;
      min-height: 100px;
      border-radius: var(--border-radius, 6px);
      padding: 1.25rem;
      box-shadow: none;
    }

    .cdk-drag-animating {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }

    .cdk-drop-list-dragging .cdk-drag {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }

    .cdk-drag-preview {
      box-sizing: border-box;
      border-radius: 4px;
      box-shadow: 0 5px 5px -3px rgba(0, 0, 0, 0.2),
                  0 8px 10px 1px rgba(0, 0, 0, 0.14),
                  0 3px 14px 2px rgba(0, 0, 0, 0.12);
    }

    /* Estilo para a área do drop list quando arrastável */
    .cdk-drop-list-receiving,
    .cdk-drop-list-dragging {
      background: var(--surface-0, #fdfdfd);
      border-radius: var(--border-radius, 6px);
      opacity: 0.9;
    }

    /* Overrides para garantir que a timeline do PrimeNG não interfira com o drag/drop */
    .p-timeline .p-timeline-event-content {
        position: relative;
        z-index: 1;
        /* Remover o padding que o p-timeline-event-content coloca,
           pois o nosso .task-item-wrapper já tem o padding. */
        padding: 0 !important; 
        /* A margem entre itens será controlada pela timeline, não pelo item arrastável */
        margin-bottom: 0 !important; 
    }

    /* Assegurar que o p-timeline-event não adiciona margens indesejadas no DOM que quebram o drag */
    .p-timeline .p-timeline-event {
        margin-bottom: 1.5rem; /* Isso adiciona o espaçamento entre os eventos da timeline */
    }

    /* Remove o margin-bottom do último evento para não ter espaço extra no final da timeline */
    .p-timeline .p-timeline-event:last-child {
        margin-bottom: 0;
    }
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
          orderIndex: data['orderIndex'] !== undefined ? data['orderIndex'] : 0, // <<-- Inicializa orderIndex
        };
        tasks.push(task);
      });
      // Ordena por dateTime primeiro, e depois por orderIndex
      this.allTasks = tasks.sort((a, b) => {
        const dateComparison = a.dateTime.getTime() - b.dateTime.getTime();
        if (dateComparison !== 0) {
          return dateComparison;
        }
        return a.orderIndex - b.orderIndex; // Segunda ordem: por orderIndex
      });
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
    
    // Define o orderIndex para o último da lista ou 0 se for o primeiro
    // Calcula o maxOrderIndex apenas para as tarefas do dia selecionado
    const maxOrderIndexForSelectedDay = this.currentTasks.length > 0
        ? Math.max(...this.currentTasks.map(t => t.orderIndex))
        : -1;
    const newOrderIndex = maxOrderIndexForSelectedDay + 1;

    const newTask: Task = {
      title: this.newTaskTitle,
      description: this.newTaskDescription,
      dateTime: this.newTaskDateTime,
      time: taskTime,
      priority: this.newTaskPriority,
      completed: false,
      userId: this.userId,
      originalDateTime: this.newTaskDateTime,
      orderIndex: newOrderIndex, // <<-- Define o orderIndex para novas tarefas
    };

    try {
      const docRef = await addDoc(collection(this.firestore, 'tasks'), newTask);
      newTask.id = docRef.id;
      this.allTasks.push(newTask);
      // Re-ordena e filtra para que a nova tarefa apareça na posição correta
      this.allTasks.sort((a, b) => {
        const dateComparison = a.dateTime.getTime() - b.dateTime.getTime();
        if (dateComparison !== 0) return dateComparison;
        return a.orderIndex - b.orderIndex;
      });
      this.filterTasksBySelectedDay(); // Atualiza a lista exibida
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
    // Primeiro, desativa o modo de edição para qualquer outra tarefa
    this.currentTasks.forEach(t => {
      if (t.isEditing && t.id !== task.id) {
        t.isEditing = false;
      }
    });

    task.isEditing = true;
    task.originalDateTime = task.dateTime ? new Date(task.dateTime.getTime()) : new Date();
  }

  cancelEdit(task: Task): void {
    task.isEditing = false;
    this.fetchTasks(); 
  }

  async saveTask(task: Task): Promise<void> {
    if (!task.id) return;

    task.time = task.originalDateTime ? task.originalDateTime.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '';
    task.dateTime = task.originalDateTime || new Date(); 

    try {
      const taskRef = doc(this.firestore, 'tasks', task.id);
      await updateDoc(taskRef, {
        title: task.title,
        description: task.description,
        priority: task.priority,
        dateTime: task.dateTime, 
        time: task.time 
      });
      task.isEditing = false; 

      this.allTasks.sort((a, b) => {
        const dateComparison = a.dateTime.getTime() - b.dateTime.getTime();
        if (dateComparison !== 0) return dateComparison;
        return a.orderIndex - b.orderIndex;
      });
      this.filterTasksBySelectedDay(); 
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
      this.allTasks = this.allTasks.filter(t => t.id !== task.id); 

      this.filterTasksBySelectedDay(); 
      await this.updateTaskOrderInFirestore();
      
      this.messageService.add({severity:'success', summary: 'Sucesso', detail: 'Tarefa removida!'});
    } catch (error: any) {
      this.messageService.add({severity:'error', summary: 'Erro', detail: `Falha ao remover tarefa: ${error.message}`});
      console.error("Erro ao remover tarefa:", error);
    }
  }

  // Novo método para Drag and Drop
  async drop(event: any): Promise<void> { 
    if (event.previousIndex === event.currentIndex) {
      return; // Não faz nada se a posição não mudou
    }
    // moveItemInArray do Angular CDK manipula o array localmente
    moveItemInArray(this.currentTasks, event.previousIndex, event.currentIndex);
    await this.updateTaskOrderInFirestore();
    this.messageService.add({severity:'success', summary: 'Sucesso', detail: 'Ordem das tarefas atualizada!'});
  }

  // Métodos para mover com as setas
  async moveTaskUp(task: Task): Promise<void> {
    const currentIndex = this.currentTasks.findIndex(t => t.id === task.id);
    if (currentIndex > 0) {
      moveItemInArray(this.currentTasks, currentIndex, currentIndex - 1);
      await this.updateTaskOrderInFirestore();
      this.messageService.add({severity:'success', summary: 'Sucesso', detail: 'Tarefa movida para cima!'});
    }
  }

  async moveTaskDown(task: Task): Promise<void> {
    const currentIndex = this.currentTasks.findIndex(t => t.id === task.id);
    if (currentIndex < this.currentTasks.length - 1) {
      moveItemInArray(this.currentTasks, currentIndex, currentIndex + 1);
      await this.updateTaskOrderInFirestore();
      this.messageService.add({severity:'success', summary: 'Sucesso', detail: 'Tarefa movida para baixo!'});
    }
  }

  // Novo método para atualizar o orderIndex no Firestore
  private async updateTaskOrderInFirestore(): Promise<void> {
    const batch = writeBatch(this.firestore); 
    
    for (let i = 0; i < this.currentTasks.length; i++) {
      const task = this.currentTasks[i];
      if (task.id && task.orderIndex !== i) {
        const taskRef = doc(this.firestore, 'tasks', task.id);
        batch.update(taskRef, { orderIndex: i });
        task.orderIndex = i; 
      }
    }

    try {
      await batch.commit();
    } catch (error: any) {
      this.messageService.add({severity:'error', summary: 'Erro', detail: `Falha ao salvar a ordem: ${error.message}`});
      console.error("Erro ao salvar ordem das tarefas:", error);
    }
  }

  // --- Filtros e Seleção de Dia ---
  selectDay(day: string): void {
    this.selectedDay = day;
    this.filterTasksBySelectedDay();
    this.resetNewTaskForm(); 
  }

  filterTasksBySelectedDay(): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0); 

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
          return true; 
      }
    });

    this.currentTasks.sort((a, b) => a.orderIndex - b.orderIndex);

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
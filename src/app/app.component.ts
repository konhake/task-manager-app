// app.component.ts
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common'; // Necessário para *ngIf, *ngFor
import { FormsModule } from '@angular/forms'; // Necessário para [(ngModel)]

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
import { ConfirmationService, MessageService } from 'primeng/api'; // Para injetar o MessageService
import { SpeedDialModule } from 'primeng/speeddial';
import { FloatLabelModule } from 'primeng/floatlabel';

// Angular CDK
import { moveItemInArray, DragDropModule } from '@angular/cdk/drag-drop'; // <<-- ESTA IMPORTAÇÃO É CRUCIAL

// Firebase
import { Auth, GoogleAuthProvider, signInWithPopup, signOut, user, User } from '@angular/fire/auth';
import { Firestore, collection, addDoc, query, where, getDocs, deleteDoc, doc, updateDoc, writeBatch } from '@angular/fire/firestore';
import { Observable, Subscription } from 'rxjs';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { DialogModule } from 'primeng/dialog';
import { provideAnimations } from '@angular/platform-browser/animations';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
interface Task {
  id?: string;
  title: string;
  description: string;
  dateTime: Date;
  time: string;
  priority: 'Urgente' | 'Normal' | 'Baixa';
  completed: boolean;
  userId: string;
  originalDateTime?: Date;
  orderIndex: number;
  isEditing?: boolean;
  category?: string;
}

interface TaskOption {
  label: string;
  value: string;
}

interface TaskGroup {
  label: string;
  value?: string;
  items: TaskOption[];
}

interface SelectItem {
  label: string;
  value: any;
}

interface MenuItem {
  icon?: string;
  tooltip?: string;
  command?: () => void;
  disabled?: boolean;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
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
    DragDropModule,
    AutoCompleteModule,
    DialogModule,
    SpeedDialModule,
    ConfirmDialogModule,
    FloatLabelModule
  ],
  providers: [    provideAnimations(), // Fornece o módulo de animações
    MessageService,      // Fornece MessageService a nível global
    ConfirmationService], // Prover MessageService aqui para toasts
  template: `
 <p-confirmDialog></p-confirmDialog>
  <p-toast></p-toast>
  <div class="main-container">
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
                        [raised]="true"
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
  <p-autoComplete
    id="newTaskTitle"
    [(ngModel)]="newTaskTitle"
    [suggestions]="filteredGroupedTasks"
    (completeMethod)="searchGrouped($event)"
    [dropdown]="true"
    [forceSelection]="false"
    placeholder="Digite ou selecione a tarefa"
    field="label"
    (onSelect)="onNewTaskTitleSelect($event)" (onBlur)="onNewTaskTitleBlur($event)"   styleClass="custom-autocomplete"
    [group]="true"
    appendTo="body">
    <ng-template pTemplate="group" let-group>
      <div class="p-d-flex p-jc-between p-ai-center" style="font-weight: bold; padding: 0.5rem 0.75rem; background-color: #f0f0f0;">
        <span>{{group.label}}</span>
      </div>
    </ng-template>
    <ng-template let-item pTemplate="item">
      <div class="p-d-flex p-ai-center p-jc-between w-full">
        <div>{{item.label}}</div>
        <button pButton icon="pi pi-times" class="p-button-rounded p-button-text p-button-danger p-button-sm"
                (click)="removeAutoCompleteItem(item, $event)"
                pTooltip="Remover este item da categoria">
        </button>
      </div>
    </ng-template>
  </p-autoComplete>
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
                  [minDate]="todayMinDate"
                  [appendTo]="'body'"
                  [style]="{'width': '100%'}"
                  class="w-full"
              ></p-calendar>
            </div>

            <div class="p-field">
              <label for="newTaskPriority">Prioridade</label>
              <p-dropdown id="newTaskPriority" [(ngModel)]="newTaskPriority" [options]="priorityOptions" optionLabel="label" optionValue="value" placeholder="Selecione a Prioridade">
                <ng-template let-option pTemplate="item">
                  <div class="p-d-flex p-ai-center">
                    <i [class]="option.icon" style="margin-right: 8px;" [ngStyle]="{'color': option.color}"></i>
                    <div [ngStyle]="{'color': option.color}">{{ option.label }}</div>
                  </div>
                </ng-template>
              </p-dropdown>
            </div>
            
            <div class="button-actions-selector">
              <button pButton type="button" label="Adicionar Tarefa" icon="pi pi-plus" (click)="addTask()" [disabled]="!newTaskTitle || !newTaskDateTime"></button>
              <p-button
                  label="Eliminar Todas as Tarefas de {{ selectedDay }}"
                  icon="pi pi-times"
                  styleClass="p-button-danger p-mr-2"
                  (click)="confirmDeleteAllTasksToday()"
                  [raised]="true"
                  [outlined]="true"
                  [disabled]="currentTasks.length === 0"
              ></p-button>
              <p-button
                  label="Eliminar TODAS as Minhas Tarefas"
                  icon="pi pi-trash"
                  styleClass="p-button-danger"
                  (click)="confirmDeleteAllUserTasks()"
                  [raised]="true"
                  [disabled]="allTasks.length === 0"
              ></p-button>
            </div>

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
              <div cdkDropList (cdkDropListDropped)="drop($event)" class="task-list-drop-area">
                <p-timeline [value]="currentTasks" layout="vertical">
                  <ng-template pTemplate="marker" let-task>
                      <span class="custom-marker" [class]="{
                          'priority-urgent': task.priority === 'Urgente' && !task.completed,
                          'priority-normal': task.priority === 'Normal' && !task.completed,
                          'priority-low': task.priority === 'Baixa' && !task.completed,
                          'task-completed': task.completed
                      }">
                          <i [ngClass]="{
                            'pi': true,
                            'pi-exclamation-triangle': task.priority === 'Urgente' && !task.completed,
                            'pi-info-circle': task.priority === 'Normal' && !task.completed,
                            'pi-arrow-down': task.priority === 'Baixa' && !task.completed,
                            'pi-check-circle': task.completed
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
                                <div style="display: flex;">
                                  <p-tag *ngIf="task.category" severity="contrast" [value]="task.category" styleClass="mb-2"></p-tag>
                                  <h4 class="p-m-0 task-title" [class.line-through]="task.completed" [ngStyle]="{'color': task.completed ? 'green' : 'black', 'padding-left': '10px'}">{{ task.title }}</h4>
                                  <span *ngIf="task.completed" style="margin-left: 10px; color: green;">(Concluída)</span>
                                </div>
                                <span *ngIf="task.description" class="p-mt-2 task-description"> {{ task.description }}</span>
                                <p class="p-m-0 p-text-sm p-text-secondary">{{ task.time }}</p>
                              </div>

                                  <div class="speed-dial-container">
                                    <p-speedDial
                                    [model]="getSpeedDialItems(task, currentTasks)"
                                    direction="left"
                                    mask="true"
                                    showTooltip="true"
                                    [transitionDelay]="100" ></p-speedDial>
                                  </div>
                          </div>

                          <div *ngIf="task.isEditing" class="p-fluid task-edit-block">
                               <div class="p-field">
      <label for="editTaskTitle_{{task.id}}">Título</label>
      <p-autoComplete
        id="editTaskTitle_{{task.id}}"
        [(ngModel)]="task.title" [suggestions]="filteredGroupedTasks"
        (completeMethod)="searchGrouped($event)"
        [dropdown]="true"
        [forceSelection]="false"
        placeholder="Edite o título da tarefa"
        field="label"
        (onSelect)="onEditTaskTitleSelect(task, $event)" (onBlur)="onEditTaskTitleBlur(task, $event)"     styleClass="custom-autocomplete"
        [group]="true"
        appendTo="body">
        <ng-template pTemplate="group" let-group>
          <div class="p-d-flex p-jc-between p-ai-center" style="font-weight: bold; padding: 0.5rem 0.75rem; background-color: #f0f0f0;">
            <span>{{group.label}}</span>
          </div>
        </ng-template>
        <ng-template let-item pTemplate="item">
          <div class="p-d-flex p-ai-center p-jc-between w-full">
            <div>{{item.label}}</div>
            <button pButton icon="pi pi-times" class="p-button-rounded p-button-text p-button-danger p-button-sm"
                    (click)="removeAutoCompleteItem(item, $event)"
                    pTooltip="Remover este item da categoria">
            </button>
          </div>
        </ng-template>
      </p-autoComplete>
    </div>
                            <div class="p-field">
                              <label for="newTaskDescription">Descrição (Opcional)</label>
                              <textarea id="editTaskDescription_{{task.id}}" pInputTextarea [(ngModel)]="task.description" rows="3"></textarea>
                            </div>

                                        <div class="p-field">
              <label for="taskDateTime">Data e Hora da Tarefa</label>
              <p-calendar
                  id="taskDateTime"
                  [(ngModel)]="task.originalDateTime"
                  [showTime]="true"
                  hourFormat="24"
                  dateFormat="dd/mm/yy"
                  [locale]="calendar_pt"
                  placeholder="Data e Hora da Tarefa"
                  [minDate]="todayMinDate"
                  [appendTo]="'body'"
                  [style]="{'width': '100%'}"
                  class="w-full"
              ></p-calendar>
            </div>

                                                       <div class="p-field">
                            </div>

                            <div class="p-field">
                              <label for="editTaskPriority_{{task.id}}">Prioridade</label>
                              <p-dropdown id="editTaskPriority_{{task.id}}" [options]="priorityOptions" [(ngModel)]="task.priority" placeholder="Prioridade" optionLabel="label" optionValue="value" class="p-inputtext" />
                            </div>

                            <div class="p-d-flex p-jc-end" style="gap: 20px; padding-bottom: 20px">
                              <p-button icon="pi pi-check" styleClass="p-button-success p-ml-2" (click)="saveTask(task)"></p-button>
                              <p-button icon="pi pi-times" styleClass="p-button-warn p-button-text" (click)="cancelEdit(task)"></p-button>
                            </div>
                          </div>
                      </div>

                      <p-dialog header="Categorizar Tarefa" [(visible)]="displayCategoryDialog" [modal]="true">
                        <div class="p-fluid">
                          <p>O item "<strong>{{newlyAddedTaskValue}}</strong>" não existe nas suas categorias. Por favor, categorize-o:</p>
                          <div class="p-field">
                            <label for="categoryDropdown">Categoria</label>
                            <p-dropdown id="categoryDropdown" [(ngModel)]="selectedCategoryForNewTask" [options]="availableCategories" optionLabel="label" placeholder="Selecione uma categoria"></p-dropdown>
                          </div>
                        </div>
                        <ng-template pTemplate="footer">
                          <p-button label="Cancelar" icon="pi pi-times" styleClass="p-button-secondary" (click)="cancelCategorization()"></p-button>
                          <p-button label="Categorizar" icon="pi pi-check" styleClass="p-button-success p-ml-2" (click)="categorizeTaskTitle()"></p-button>
                        </ng-template>
                      </p-dialog>
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
:host {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--surface-ground, #f8f9fa);
  font-family: var(--font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol");
  color: var(--text-color, #495057);
  /* Adicionado: Garante que o host pode encolher sem criar scroll indesejado */
  min-width: 0;
  overflow-x: hidden;
  /* Evita scroll horizontal no corpo principal */
}

.task-edit-block {
  padding-top: 40px;
  padding-left: 20px;
  padding-right: 20px;
  background-color: #e2e8f0;
  border-radius: 2%;
}

i.pi.pi-bars:hover {
  cursor: grab;
}

.p-textarea {
  width: 100%;
}

::ng-deep button.p-ripple.p-button.p-component.p-button-danger.p-mr-2, ::ng-deep button.p-ripple.p-button.p-component.p-button-danger {
    width: 100% !important;
  }

::ng-deep .p-speeddial-item{
  .pi-trash:before {color: #ef4444;}
  .pi-arrow-right:before {color: #1976D2;}
  .pi-pencil:before {color: #f97316;}
  .pi-check:before {color: #15803d;}
  .pi-arrow-down:before {color: purple;}
}

/* Manter esta regra para o modal se a altura fixa for intencional, 
  mas cuidado para não cortar o conteúdo se ele exceder 300px */
::ng-deep .p-dialog-content {
  height: 300px;
}

::ng-deep .custom-autocomplete.p-autocomplete.p-component.p-inputwrapper {
  width: 100%;
  /* Certifique-se que não há min-width aqui */
  min-width: 0;
}

::ng-deep .p-timeline-event-opposite {
  display: none;
}

::ng-deep li.p-autocomplete-option-group {
  color: white;
  background: var(--p-autocomplete-option-group-color);
}

::ng-deep li.p-autocomplete-option {
  padding-left: 30px;
}

.main-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  /* Adicionado: Permite que o container principal encolha */
  min-width: 0;
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
  /* Adicionado: Garante que o topbar pode encolher */
  min-width: 0;
}

.topbar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 1200px;
  /* Adicionado: Permite que o conteúdo do topbar encolha */
  min-width: 0;
  flex-wrap: nowrap;
  /* Tenta manter em uma linha, mas os itens internos devem ser flexíveis */
}

.branding {
  display: flex;
  align-items: center;
  font-size: 1.5rem;
  font-weight: bold;
  /* Adicionado: Permite que o branding encolha */
  min-width: 0;
  flex-shrink: 1;
  /* Garante que ele encolhe */
}

.brand-icon {
  margin-right: 0.5rem;
  font-size: 1.8rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  /* Adicionado: Permite que o user-info encolha */
  min-width: 0;
  flex-shrink: 1;
  /* Garante que ele encolhe */
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  margin-right: 0.75rem;
  border: 2px solid var(--primary-color-text, #ffffff);
  object-fit: cover;
  flex-shrink: 0;
  /* Não encolhe a imagem */
}

.user-name {
  font-weight: 500;
  white-space: nowrap;
  /* Já tinha uma media query para esconder. Mantenha se quiser. */
  @media screen and (max-width: 575px) {
    display: none;
  }
  /* Adicionado: Pode ser útil para quebrar a linha se o nome for muito longo */
  /* word-break: break-word; */
  /* overflow: hidden; */
  /* text-overflow: ellipsis; */
}

.login-prompt {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  padding: 0.5rem 0;
  min-width: 0;
  /* Permite encolher */
}

.content-wrapper {
  flex-grow: 1;
  padding: 1rem;
  display: flex;
  justify-content: center;
  box-sizing: border-box;
  /* Adicionado: Permite que o wrapper do conteúdo encolha */
  min-width: 0;
  overflow-x: hidden;
  /* Evita scroll horizontal aqui também */
}

.app-layout {
  display: grid;
  width: 100%;
  max-width: 1200px;
  gap: 1.5rem;
  /* grid-template-columns: 1fr; */
  /* Removido para usar apenas flexbox em mobile para maior flexibilidade */
  grid-template-areas:
    "form"
    "timeline";
  /* Adicionado: Permitir que a grelha encolha */
  min-width: 0;
  /* Usar flexbox em mobile para o layout principal para melhor encolhimento */
  display: flex;
  flex-direction: column;
}

.task-form-column {
  grid-area: form;
  min-width: 0;
  /* Permite que a coluna encolha */
}

.task-timeline-column {
  grid-area: timeline;
  min-width: 0;
  /* Permite que a coluna encolha */
}

@media screen and (min-width: 768px) {
  .content-wrapper {
    padding: 1.5rem;
  }

  .app-layout {
    gap: 2rem;
    grid-template-columns: 1fr 1.5fr;
    grid-template-areas: "form timeline";
    /* Retornar ao grid em desktop */
    display: grid;
  }
}

@media screen and (min-width: 992px) {
  .content-wrapper {
    padding: 2rem;
  }

  .app-layout {
    grid-template-columns: 1fr 2fr;
  }
}

p-card {
  height: 100%;
  border-radius: var(--border-radius, 6px);
  /* overflow: hidden; */
  /* Cuidado com este overflow, pode cortar conteúdo se o card for muito pequeno */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  min-width: 0;
  /* Importante para o card encolher */

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
    min-width: 0;
    /* Garante que o header do card encolhe */
  }
}

.day-selector {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 1.5rem;
  gap: 0.75rem;
  min-width: 0;
  /* Permite que o seletor de dia encolha */
}

.button-actions-selector {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 1.5rem;
  gap: 0.75rem;
  min-width: 0;
  * {
    width: 100% !important;
  }
  /* Permite que o seletor de dia encolha */
}

.p-button-outlined {
  padding: 0.6rem 1.2rem;
  font-size: 0.9rem;
  border-radius: var(--border-radius, 6px);
  transition: all 0.2s ease-in-out;
  border: 1px solid;
  flex-grow: 1;
  min-width: 90px;
  /* Mantém um min-width para o botão, mas se a tela for menor que 90px, ele vazará. 
                                    Pode ajustar ou remover dependendo da sua necessidade. */

  @media screen and (min-width: 576px) {
    flex-grow: 0;
    width: auto;
  }

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
  flex-wrap: wrap;
  text-align: center;
  justify-content: center;
  min-width: 0;
  /* Permite que o info box encolha */

  .pi {
    font-size: 1.2rem;
    color: var(--blue-600, #2196F3);
  }

  span {
    flex-basis: 100%;
    text-align: center;
    min-width: 0;
    /* Permite que o span encolha */
  }

  span:first-child {
    flex-basis: auto;
  }
}

.p-field {
  margin-bottom: 1.5rem;
  min-width: 0;
  /* Permite que o campo encolha */
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
  min-width: 0;
  /* Importante para que os inputs encolham */

  .p-inputtext,
  .p-inputtextarea {
    padding: 0.75rem 0.75rem;
  }

  .p-inputtextarea {
    min-height: 4rem;
    resize: vertical;
  }
}

.custom-timeline-container {
  position: relative;
  padding-left: 2rem;
  padding-right: 0.5rem;
  width: 100%;
  box-sizing: border-box;
  min-width: 0;
  /* Permite que o container da timeline encolha */
}

.custom-timeline-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 1.25rem;
  height: 100%;
  width: 2px;
  background-color: var(--surface-border, #dee2e6);
  z-index: 1;
}

.task-list-drop-area {
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
  min-width: 0;
  /* Permite que a área de drop encolha */
}

.timeline-item-wrapper {
  display: flex;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  position: relative;
  z-index: 2;
  width: 100%;
  box-sizing: border-box;
  overflow: visible;
  min-width: 0;
  /* Permite que o wrapper do item da timeline encolha */
}

.timeline-item-wrapper:last-child {
  margin-bottom: 0;
}

.timeline-marker {
  flex-shrink: 0;
  position: relative;
  z-index: 3;
  margin-right: 1.5rem;
}

.custom-marker {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  color: var(--surface-card, #ffffff);
  box-shadow: 0 0 0 3px var(--surface-card, #ffffff), 0 2px 5px rgba(0, 0, 0, 0.2);
  flex-shrink: 0;
  /* Não encolhe o marcador */

  i {
    font-size: 1.3rem;
  }

  &.priority-urgent {
    background-color: var(--red-500, #ef4444);
  }

  &.priority-normal {
    background-color: var(--orange-500, #f97316);
  }

  &.priority-low {
    background-color: var(--blue-600, #2196F3);
  }

  &.task-completed {
    background-color: var(--green-700, #15803d);
  }
}

.cdk-drag-handle {
  position: absolute;
  top: 0rem;
  left: 0rem;
  cursor: grab;
  color: transparent;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease-in-out;
  border-radius: 50%;
  flex-shrink: 0;
  /* Não encolhe o drag handle */

  &:hover {
    background-color: rgba(173, 216, 230, 0.4);
  }

  i {
    font-size: 2.5rem;
  }
}

.task-content {
  flex-grow: 1;
  background-color: var(--surface-card, #ffffff);
  border: 1px solid var(--surface-border, #e0e0e0);
  border-radius: var(--border-radius, 6px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 1.25rem;
  width: 100%;
  box-sizing: border-box;
  min-width: 0;
  /* SUPER IMPORTANTE: Permite que o conteúdo da tarefa encolha */
  position: relative;
  display: flex;
  flex-direction: column;


  &.task-completed {
    opacity: 0.8;
    background-color: var(--surface-100, #f5f5f5);

    .task-title,
    .task-description {
      color: var(--text-color-secondary, #757575);
    }
  }

  .p-d-flex.p-jc-between.p-ai-start {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    /* ADICIONADO/VERIFICADO: Permitir quebra de linha para flex items */
    min-width: 0;
    /* VERIFICADO: Permite que o container flex encolha */
    width: 100%;
    /* VERIFICADO: Garante que ocupa a largura total disponível */
  }

  .p-flex-grow-1 {
    flex-grow: 1;
    flex-basis: 0;
    /* ADICIONADO: Permite que este item flex comece com base zero para melhor distribuição */
    min-width: 0;
    /* VERIFICADO: Garante que este item flex pode encolher */
    margin-right: 0.5rem;
    word-break: break-word;
    /* ADICIONADO: Permite que o texto quebre dentro do elemento flex */
    overflow-wrap: break-word;
    /* ADICIONADO: Compatibilidade para quebra de palavras */
    white-space: normal; /* ADICIONADO: Garante que o texto quebra a linha */

    @media screen and (max-width: 575px) {
      flex-basis: 100%;
      margin-right: 0;
      margin-bottom: 0.5rem;
    }
  }


  .task-title {
    color: var(--text-color, #495057);
    font-size: 1.15rem;
    margin-bottom: 0.25rem;
    word-break: break-word;
    /* ADICIONADO/VERIFICADO: Quebra palavras longas */
    overflow-wrap: break-word;
    /* ADICIONADO/VERIFICADO: Suporte mais amplo para quebra de palavras */
    min-width: 0;
    /* VERIFICADO: Permite que o título encolha */
    white-space: normal; /* ADICIONADO: Garante que o texto quebra a linha */
  }

  .line-through {
    text-decoration: line-through;
  }

  .p-text-sm {
    font-size: 0.85rem;
    margin-bottom: 0.75rem;
    word-break: break-word;
    /* ADICIONADO/VERIFICADO: Garante que o texto pequeno também quebre */
    overflow-wrap: break-word;
    /* ADICIONADO/VERIFICADO: Compatibilidade para quebra de palavras */
    min-width: 0;
    /* VERIFICADO: Permite que o texto encolha */
    white-space: normal; /* ADICIONADO: Garante que o texto quebra a linha */
  }

  .task-description {
    margin-top: 0.75rem;
    font-size: 0.95rem;
    color: var(--text-color, #495057);
    line-height: 1.4;
    word-break: break-word;
    /* ADICIONADO/VERIFICADO: Quebra palavras longas */
    overflow-wrap: break-word;
    /* ADICIONADO/VERIFICADO: Suporte mais amplo para quebra de palavras */
    min-width: 0;
    /* VERIFICADO: Permite que a descrição encolha */
    white-space: normal; /* ADICIONADO: Garante que o texto quebra a linha */
  }

  .action-buttons {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    margin-left: auto;
    gap: 0.25rem;
    flex-shrink: 0;
    /* VERIFICADO: Não encolhe os botões de ação */
    min-width: 0;
    /* ADICIONADO/VERIFICADO: Se os botões forem o problema, assegure que eles não forçam o container */
    flex-basis: auto; /* ADICIONADO: Permite que o container dos botões determine sua base de tamanho automaticamente */

    @media screen and (min-width: 576px) {
      flex-direction: row;
      gap: 0.5rem;
    }
  }

  .p-button-sm {
    padding: 0.4rem;
    font-size: 0.8rem;
    min-width: 2rem;
    height: 2rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    /* VERIFICADO: Não encolhe o botão */
  }

  .p-field {
    margin-bottom: 1rem;

    label {
      margin-bottom: 0.4rem;
      font-size: 0.9rem;
    }
  }

  .cdk-drag-handle {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    cursor: grab;
    color: var(--text-color-secondary, #6c757d);
    z-index: 10;
    padding: 0.2rem;
    border-radius: var(--border-radius);
    transition: background-color 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    /* Não encolhe o drag handle */

    &:hover {
      background-color: var(--surface-100, #f1f3f5);
    }

    i {
      font-size: 1rem;
    }
  }

  .p-tag {
    position: absolute;
    top: 0.5rem;
    left: 0.5rem;
    padding: 0.2rem 0.5rem;
    font-size: 0.7rem;
    line-height: 1;
    border-radius: var(--border-radius, 4px);
    z-index: 5;
    flex-shrink: 0;
    /* Não encolhe a tag */
  }
}

@media screen and (min-width: 768px) {
  .custom-timeline-container {
    padding-left: 0;
    padding-right: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .custom-timeline-container::before {
    left: 50%;
    transform: translateX(-50%);
  }

  .task-list-drop-area {
    align-items: stretch;
  }

  .timeline-item-wrapper {
    flex-direction: row;
    margin-bottom: 2rem;
    max-width: 800px;
    width: 100%;

    &:nth-child(even) {
      flex-direction: row-reverse;
      justify-content: flex-end;

      .timeline-marker {
        margin-left: 1.5rem;
        margin-right: 0;
        transform: translateX(0);
      }

      .task-content {
        text-align: right;
        margin-right: 2rem;
        margin-left: 0;
        max-width: calc(50% - 3.5rem);
      }

      .action-buttons {
        align-items: flex-start;
        flex-direction: row;
      }

      .cdk-drag-handle {
        left: auto;
        right: 0.5rem;
      }

      .p-tag {
        left: auto;
        right: 0.5rem;
      }

      .p-d-flex.p-jc-between.p-ai-start {
        flex-direction: row-reverse;
      }
    }

    &:nth-child(odd) {
      flex-direction: row;
      justify-content: flex-start;

      .timeline-marker {
        margin-right: 1.5rem;
        margin-left: 0;
        transform: translateX(0);
      }

      .task-content {
        text-align: left;
        margin-left: 2rem;
        margin-right: 0;
        max-width: calc(50% - 3.5rem);
      }

      .action-buttons {
        flex-direction: row;
      }

      .cdk-drag-handle {
        left: 0.5rem;
        right: auto;
      }

      .p-tag {
        left: 0.5rem;
        right: auto;
      }
    }
  }
}

p-progressbar {
  width: 180px;
  height: 20px;
  border-radius: 10px;
  background-color: var(--surface-200, #e9ecef);

  @media screen and (max-width: 575px) {
    width: 100%;
    height: 15px;

    .p-progressbar-label {
      font-size: 0.75rem;
    }
  }

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

.no-tasks {
  text-align: center;
  padding: 3rem;
  color: var(--text-color-secondary, #6c757d);
  font-size: 1.1rem;
  font-style: italic;
}

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
  margin-bottom: 1.5rem;

  @media screen and (min-width: 768px) {
    margin-bottom: 2rem;
    max-width: calc(50% - 3.5rem);
  }
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
  padding: 1.25rem;
  background-color: var(--surface-card, #ffffff);
  border: 1px solid var(--surface-border, #e0e0e0);
}

.cdk-drop-list-receiving,
.cdk-drop-list-dragging {
  background: var(--surface-0, #fdfdfd);
  border-radius: var(--border-radius, 6px);
  opacity: 0.9;
}

.p-tag-danger {
  background-color: var(--red-500, #ef4444);
  color: var(--red-50, #fef2f2);
}

.p-tag-warning {
  background-color: var(--orange-500, #f97316);
  color: var(--orange-50, #fff7ed);
}

.p-tag-success {
  background-color: var(--green-500, #22c55e);
  color: var(--green-50, #f0fdf4);
}

/* Classes de utilidade existentes */
.p-mr-2 {
  margin-right: 0.5rem !important;
}

.p-mb-2 {
  margin-bottom: 0.5rem !important;
}

.p-mr-1 {
  margin-right: 0.25rem !important;
}

.p-mt-3 {
  margin-top: 1rem !important;
}

.p-mb-3 {
  margin-bottom: 1rem !important;
}

.p-mb-4 {
  margin-bottom: 1.5rem !important;
}

.p-d-flex {
  display: flex !important;
}

.p-jc-center {
  justify-content: center !important;
}

.p-ai-center {
  align-items: center !important;
}

.p-jc-between {
  justify-content: space-between !important;
}

.p-ai-start {
  align-items: flex-start !important;
}

.p-flex-column {
  flex-direction: column !important;
}

.p-ai-end {
  align-items: flex-end !important;
}

.p-flex-grow-1 {
  flex-grow: 1 !important;
}

.p-text-center {
  text-align: center !important;
}

.p-text-bold {
  font-weight: bold !important;
}

.p-text-sm {
  font-size: 0.875rem !important;
}

.p-text-lg {
  font-size: 1.125rem !important;
}

.p-text-secondary {
  color: var(--text-color-secondary) !important;
}

.p-text-italic {
  font-style: italic !important;
}

.p-m-0 {
  margin: 0 !important;
}

.w-full {
  width: 100% !important;
}

/* Nova regra para o componente p-speeddial para posicionamento absoluto */
p-speeddial {
    position: absolute !important; /* Força o posicionamento absoluto */
    top: 0rem; /* Posição do topo do pai relativo (.task-content) */
    right: 0rem; /* Posição da direita do pai relativo (.task-content) */
    z-index: 10; /* Garante que está acima de outros conteúdos */
    display: block !important; /* Garante que é exibido como um elemento de bloco */
    margin: 0 !important; /* Remove quaisquer margens padrão */
    flex-shrink: 0 !important; /* Garante que não encolhe */
    width: auto !important; /* Permite que ocupe a sua largura natural */
    height: auto !important; /* Permite que ocupe a sua altura natural */
}
  `]
})

export class AppComponent implements OnInit, OnDestroy {
  // Injeções de Dependência
  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);
  private messageService: MessageService = inject(MessageService);
  private confirmationService: ConfirmationService = inject(ConfirmationService);

  // Propriedades de Autenticação e Utilizador
  userLoggedIn: boolean = false;
  userName: string = 'Convidado';
  userPhotoUrl: string | null = null;
  userId: string | null = null;
  private userSubscription: Subscription | null = null;
  isLoadingAuth: boolean = true;

  // Propriedades de Gestão de Tarefas
  days: string[] = ['Hoje', 'Amanhã', 'Próximos 7 Dias'];
  selectedDay: string = 'Hoje';
  currentTasks: Task[] = [];
  allTasks: Task[] = [];
  isLoadingTasks: boolean = false;

  // Propriedades do Formulário de Nova Tarefa
  newTaskTitle: string = '';
  newTaskDescription: string = '';
  newTaskDateTime: Date | null = null;
  newTaskPriority: 'Urgente' | 'Normal' | 'Baixa' = 'Normal';
  priorityOptions = [
    { label: 'Urgente', value: 'Urgente', icon: 'pi pi-exclamation-triangle', color: ' #ef4444' },
    { label: 'Normal', value: 'Normal', icon: 'pi pi-info-circle', color: ' #f97316' },
    { label: 'Baixa', value: 'Baixa', icon: 'pi pi-arrow-down', color: ' #2196F3' }
  ];

  // Propriedades para o AutoComplete de Tarefas e Categorias Personalizadas
  defaultGroupedTasks: TaskGroup[] = [
    { label: 'Tarefas Comuns', value: 'tarefas-comuns', items: [{ label: 'Enviar email', value: 'Enviar email' }, { label: 'Reunião de equipe', value: 'Reunião de equipe' }, { label: 'Relatório mensal', value: 'Relatório mensal' }, { label: 'Fazer ligação', value: 'Fazer ligação' }] },
    { label: 'Atividades Diárias', value: 'atividades-diarias', items: [{ label: 'Verificar caixa de entrada', value: 'Verificar caixa de entrada' }, { label: 'Almoço', value: 'Almoço' }, { label: 'Planejar o dia seguinte', value: 'Planejar o dia seguinte' }, { label: 'Anotar ideias', value: 'Anotar ideias' }] },
    { label: 'Projetos', value: 'projetos', items: [{ label: 'Revisar código', value: 'Revisar código' }, { label: 'Escrever documentação', value: 'Escrever documentação' }, { label: 'Configurar ambiente', value: 'Configurar ambiente' }] }
  ];
  groupedTasks: TaskGroup[] = [];
  filteredGroupedTasks: TaskGroup[] = [];

  // Propriedades para o Diálogo de Categorização de Nova Tarefa
  displayCategoryDialog: boolean = false;
  newlyAddedTaskValue: string = '';
  selectedCategoryForNewTask: any = null;
  availableCategories: SelectItem[] = [];

  // NOVO: Propriedade para minDate do p-calendar
  todayMinDate: Date = new Date();

  // Propriedade para o Calendário (localização PT)
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

  // Propriedades para a Barra de Progresso
  progressValue$: Observable<number>;

  // Flag para controlar se a transição diária de tarefas já foi feita na sessão atual
  private dailyTransitionDone: boolean = false;
  // Flag para controlar o fluxo de seleção/blur do autocomplete
  private isSelectionOccurring: boolean = false;

  // NOVO: Propriedade para controlar a tarefa sendo editada (se houver)
  currentEditingTask: Task | null = null;


  constructor() {
    this.progressValue$ = new Observable<number>(observer => {
      this.updateProgressBar(observer);
    });
  }

  async ngOnInit(): Promise<void> {
    this.userSubscription = user(this.auth).subscribe(async firebaseUser => {
      if (firebaseUser) {
        this.userLoggedIn = true;
        this.userName = firebaseUser.displayName || firebaseUser.email || 'Utilizador';
        this.userPhotoUrl = firebaseUser.photoURL;
        this.userId = firebaseUser.uid;
        this.isLoadingAuth = false;
        await this.loadUserCategories();
        await this.fetchTasks();
        if (!this.dailyTransitionDone) {
          await this.transitionOverdueTasks();
          this.dailyTransitionDone = true;
        }
      } else {
        this.userLoggedIn = false;
        this.userName = 'Convidado';
        this.userPhotoUrl = null;
        this.userId = null;
        this.isLoadingAuth = false;
        this.currentTasks = [];
        this.allTasks = [];
        this.groupedTasks = JSON.parse(JSON.stringify(this.defaultGroupedTasks));
        this.updateAvailableCategories();
        this.updateProgressBar();
      }
    });

    this.selectDay('Hoje');
    this.searchGrouped({ query: '' });
  }

  ngOnDestroy(): void {
    this.userSubscription?.unsubscribe();
  }

  // NOVO MÉTODO: Carrega as categorias personalizadas do utilizador
  async loadUserCategories(): Promise<void> {
    if (!this.userId) {
      this.groupedTasks = JSON.parse(JSON.stringify(this.defaultGroupedTasks));
      this.updateAvailableCategories();
      return;
    }

    try {
      const q = query(collection(this.firestore, 'userCategories'), where('userId', '==', this.userId));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userCategoriesData = querySnapshot.docs[0].data();
        const customGroups: TaskGroup[] = userCategoriesData['categories'];

        const existingValues = new Set<string>();
        this.groupedTasks = [];

        // Adiciona as categorias padrão primeiro
        this.defaultGroupedTasks.forEach(defaultGroup => {
          this.groupedTasks.push(JSON.parse(JSON.stringify(defaultGroup)));
          defaultGroup.items.forEach(item => existingValues.add(item.value.toLowerCase()));
        });

        // Adiciona ou mescla categorias personalizadas
        customGroups.forEach(customGroup => {
          const existingGroup = this.groupedTasks.find(g => g.value === customGroup.value);
          if (existingGroup) {
            customGroup.items.forEach(customItem => {
              if (!existingValues.has(customItem.value.toLowerCase())) {
                existingGroup.items.push(customItem);
                existingValues.add(customItem.value.toLowerCase());
              }
            });
          } else {
            this.groupedTasks.push(customGroup);
            customGroup.items.forEach(item => existingValues.add(item.value.toLowerCase()));
          }
        });

      } else {
        this.groupedTasks = JSON.parse(JSON.stringify(this.defaultGroupedTasks));
      }
      this.updateAvailableCategories();
    } catch (error: any) {
      console.error("Erro ao carregar categorias do utilizador:", error);
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao carregar categorias: ${error.message}` });
      this.groupedTasks = JSON.parse(JSON.stringify(this.defaultGroupedTasks));
      this.updateAvailableCategories();
    }
  }

  // NOVO MÉTODO: Salva as categorias personalizadas do utilizador
  async saveUserCategories(): Promise<void> {
    if (!this.userId) {
      console.warn('saveUserCategories: userId is null, cannot save.');
      return;
    }

    try {
      const q = query(collection(this.firestore, 'userCategories'), where('userId', '==', this.userId));
      const querySnapshot = await getDocs(q);

      const customCategoriesToSave = this.groupedTasks.map(group => ({
        label: group.label,
        value: group.value,
        items: group.items
      }));
      console.log('Attempting to save categories:', customCategoriesToSave);

      if (!querySnapshot.empty) {
        const docRef = doc(this.firestore, 'userCategories', querySnapshot.docs[0].id);
        await updateDoc(docRef, { categories: customCategoriesToSave });
        console.log("Categorias do utilizador atualizadas com sucesso no Firestore!");
      } else {
        await addDoc(collection(this.firestore, 'userCategories'), {
          userId: this.userId,
          categories: customCategoriesToSave
        });
        console.log("Novas categorias do utilizador adicionadas com sucesso no Firestore!");
      }
      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Categorias salvas com sucesso!' });
    } catch (error: any) {
      console.error("Erro ao salvar categorias do utilizador:", error);
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao salvar categorias: ${error.message}` });
    }
  }

  // NOVO MÉTODO: Atualiza as opções do dropdown de categorias
  updateAvailableCategories(): void {
    this.availableCategories = this.groupedTasks.map(group => ({
      label: group.label,
      value: group
    }));
  }

  isSameDay(d1: Date, d2: Date): boolean {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  }

  async transitionOverdueTasks(): Promise<void> {
    if (!this.userId || this.allTasks.length === 0) {
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const batch = writeBatch(this.firestore);
    let tasksUpdatedCount = 0;

    for (const task of this.allTasks) {
      if (task.id && !task.completed && task.dateTime) {
        const taskDate = new Date(task.dateTime);
        taskDate.setHours(0, 0, 0, 0);

        if (taskDate.getTime() < today.getTime()) {
          console.log(`Tarefa atrasada "${task.title}" (${task.id}) - data original: ${task.dateTime.toLocaleDateString()}`);

          const newDateTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(),
                                       task.dateTime.getHours(), task.dateTime.getMinutes(),
                                       task.dateTime.getSeconds(), task.dateTime.getMilliseconds());

          const taskRef = doc(this.firestore, 'tasks', task.id);
          batch.update(taskRef, {
            dateTime: newDateTime,
            time: newDateTime.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
          });
          tasksUpdatedCount++;

          task.dateTime = newDateTime;
          task.time = newDateTime.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
        }
      }
    }

    if (tasksUpdatedCount > 0) {
      try {
        await batch.commit();
        this.messageService.add({
          severity: 'info',
          summary: 'Tarefas Atualizadas',
          detail: `${tasksUpdatedCount} tarefas não concluídas foram movidas para "Hoje".`
        });
        console.log(`${tasksUpdatedCount} tarefas movidas para "Hoje".`);

        this.allTasks.sort((a, b) => {
          const dateComparison = a.dateTime.getTime() - b.dateTime.getTime();
          if (dateComparison !== 0) return dateComparison;
          return a.orderIndex - b.orderIndex;
        });
        this.filterTasksBySelectedDay();
      } catch (error: any) {
        this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao transitar tarefas: ${error.message}` });
        console.error("Erro ao transitar tarefas:", error);
      }
    }
  }

  getSpeedDialItems(task: Task, allTasks: Task[]): MenuItem[] {
    const items: MenuItem[] = [];
    const taskIndex = allTasks.findIndex(t => t.id === task.id);

    if (taskIndex > 0) {
      items.push({ icon: 'pi pi-arrow-up', tooltip: 'Mover para Cima', command: () => this.moveTaskUp(task) });
    }
    if (taskIndex < allTasks.length - 1) {
      items.push({ icon: 'pi pi-arrow-down', tooltip: 'Mover para Baixo', command: () => this.moveTaskDown(task) });
    }
    items.push({ icon: 'pi pi-check', tooltip: 'Completar Tarefa', disabled: task.completed, command: () => this.completeTask(task) });
    items.push({ icon: 'pi pi-pencil', tooltip: 'Editar Tarefa', command: () => this.editTask(task) });
    items.push({
      icon: 'pi pi-arrow-right',
      tooltip: 'Mover para o Dia Seguinte',
      command: () => this.moveTaskToNextDay(task)
    });
    items.push({ icon: 'pi pi-trash', tooltip: 'Remover Tarefa', command: () => this.confirmDeleteSingleTask(null, task) });

    return items;
  }

  searchGrouped(event: any) {
    let query = event.query;
    if (!query) {
      this.filteredGroupedTasks = JSON.parse(JSON.stringify(this.groupedTasks));
      return;
    }
    let filteredGroups: TaskGroup[] = [];
    for (let group of this.groupedTasks) {
      let filteredItems: TaskOption[] = [];
      for (let item of group.items) {
        if (item.label.toLowerCase().includes(query.toLowerCase())) {
          filteredItems.push(item);
        }
      }
      if (filteredItems.length > 0) {
        filteredGroups.push({ label: group.label, items: filteredItems });
      }
    }
    this.filteredGroupedTasks = filteredGroups;
  }

  // MÉTODO PARA O AUTOCOMPLETE DA NOVA TAREFA - QUANDO UM ITEM É SELECIONADO
  onNewTaskTitleSelect(event: any) {
    this.isSelectionOccurring = true;
    this.newTaskTitle = event.value?.value || event.value;
    setTimeout(() => { this.isSelectionOccurring = false; }, 50);
  }

  // MÉTODO PARA O AUTOCOMPLETE DA NOVA TAREFA - QUANDO O CAMPO PERDE O FOCO
  onNewTaskTitleBlur(event: any) {
    if (this.isSelectionOccurring) {
      setTimeout(() => { this.isSelectionOccurring = false; }, 100);
      return;
    }

    let currentInputValue: string = '';
    if (typeof this.newTaskTitle === 'object' && this.newTaskTitle !== null && 'value' in this.newTaskTitle) {
      currentInputValue = (this.newTaskTitle as TaskOption).value;
    } else if (typeof this.newTaskTitle === 'string') {
      currentInputValue = this.newTaskTitle;
    } else {
      currentInputValue = ''; // Fallback, shouldn't happen if validation is correct
    }

    if (!currentInputValue) {
      return;
    }

    const isExisting = this.groupedTasks.some(group =>
      group.items.some(item => item.value.toLowerCase() === currentInputValue.toLowerCase())
    );

    if (!isExisting) {
      setTimeout(() => {
      this.newlyAddedTaskValue = currentInputValue;
      this.selectedCategoryForNewTask = null; // Reset selection
      this.currentEditingTask = null; // Garante que não estamos no contexto de edição
      this.displayCategoryDialog = this.newlyAddedTaskValue === this.newTaskTitle;
    }, 100);
    } else {
      this.newTaskTitle = currentInputValue; // Garante que o valor final seja uma string
    }
  }

  // NOVO MÉTODO PARA O AUTOCOMPLETE DA EDIÇÃO DA TAREFA - QUANDO UM ITEM É SELECIONADO
  onEditTaskTitleSelect(task: Task, event: any) {
    this.isSelectionOccurring = true;
    task.title = event.value?.value || event.value; // Atualiza diretamente o título da tarefa
    setTimeout(() => { this.isSelectionOccurring = false; }, 50);
  }

  // NOVO MÉTODO PARA O AUTOCOMPLETE DA EDIÇÃO DA TAREFA - QUANDO O CAMPO PERDE O FOCO
  onEditTaskTitleBlur(task: Task, event: any) {
    if (this.isSelectionOccurring) {
      setTimeout(() => { this.isSelectionOccurring = false; }, 100);
      return;
    }

    // Acessa o valor do título da tarefa sendo editada
    let currentInputValue: string = typeof task.title === 'object' && task.title !== null && 'value' in task.title
        ? (task.title as TaskOption).value
        : (typeof task.title === 'string' ? task.title : '');

    if (!currentInputValue) {
      return;
    }

    const isExisting = this.groupedTasks.some(group =>
      group.items.some(item => item.value.toLowerCase() === currentInputValue.toLowerCase())
    );

    if (!isExisting) {
      setTimeout(() => {
        this.newlyAddedTaskValue = currentInputValue;
        this.selectedCategoryForNewTask = null; // Reset selection
        this.currentEditingTask = task; // DEFINE A TAREFA QUE ESTÁ A SER EDITADA
        this.displayCategoryDialog = this.newlyAddedTaskValue === this.currentEditingTask.title;
      }, 100);
    } else {
      task.title = currentInputValue; // Garante que o valor final seja uma string
    }
  }


  // MÉTODO RENOMEADO E ADAPTADO: Categoriza o título da tarefa (nova ou em edição)
  async categorizeTaskTitle() {
    if (this.selectedCategoryForNewTask && this.newlyAddedTaskValue) {
      const newTaskOption: TaskOption = {
        label: this.newlyAddedTaskValue,
        value: this.newlyAddedTaskValue
      };

      const targetGroup = this.groupedTasks.find(
        group => group.value === this.selectedCategoryForNewTask?.value?.value
      );

      if (targetGroup) {
        // Verifica se o item já existe na categoria selecionada para evitar duplicatas
        if (!targetGroup.items.some(item => item.value.toLowerCase() === newTaskOption.value.toLowerCase())) {
          targetGroup.items.push(newTaskOption);
          console.log(`Nova sugestão "${newTaskOption.label}" adicionada ao grupo "${targetGroup.label}".`);
          await this.saveUserCategories(); // Salva as categorias atualizadas no Firestore
        } else {
          this.messageService.add({severity: 'warn', summary: 'Atenção', detail: 'Essa sugestão já existe nesta categoria.'});
        }

        // Aplica o valor categorizado ao contexto correto (nova tarefa ou tarefa em edição)
        if (this.currentEditingTask) {
          this.currentEditingTask.title = newTaskOption.value; // Atualiza o título da tarefa em edição
          this.currentEditingTask.category = targetGroup.label; // Define a categoria para a tarefa em edição
          // Não precisa re-filtrar as sugestões para o autocomplete de edição aqui.
        } else {
          this.newTaskTitle = newTaskOption.value; // Atualiza o título da nova tarefa
          // Não precisamos definir newTaskCategory aqui, pois será determinado em addTask
          this.searchGrouped({ query: this.newTaskTitle }); // Re-filtra as sugestões para o formulário de nova tarefa
        }

      } else {
        console.warn('Grupo selecionado não encontrado para categorização.');
      }
      this.resetCategoryDialog(); // Fecha o diálogo e redefine as variáveis
    }
  }

  cancelCategorization() {
    // Se estiver a editar e cancelar a categorização, o título volta ao valor anterior ao blur
    if (this.currentEditingTask) {
      // Poderíamos resetar o task.title para o seu valor original ou um valor vazio
      // Por agora, vamos apenas fechar o diálogo. O utilizador pode cancelar a edição da tarefa.
    }
    this.resetCategoryDialog();
  }

  resetCategoryDialog() {
    this.displayCategoryDialog = false;
    this.newlyAddedTaskValue = '';
    this.selectedCategoryForNewTask = null;
    this.currentEditingTask = null; // IMPORTANTE: Reseta a tarefa em edição
  }

  async login(): Promise<void> {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(this.auth, provider);
      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Login realizado com sucesso!' });
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha no login: ${error.message}` });
      console.error("Erro no login:", error);
    }
  }

  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
      this.messageService.add({ severity: 'info', summary: 'Desconectado', detail: 'Sessão encerrada.' });
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao sair: ${error.message}` });
      console.error("Erro ao sair:", error);
    }
  }

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
          orderIndex: data['orderIndex'] !== undefined ? data['orderIndex'] : 0,
          category: data['category'] || undefined, // Carrega a categoria aqui
        };
        tasks.push(task);
      });
      this.allTasks = tasks.sort((a, b) => {
        const dateComparison = a.dateTime.getTime() - b.dateTime.getTime();
        if (dateComparison !== 0) {
          return dateComparison;
        }
        return a.orderIndex - b.orderIndex;
      });
      this.filterTasksBySelectedDay();
      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Tarefas carregadas!' });
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao carregar tarefas: ${error.message}` });
      console.error("Erro ao carregar tarefas:", error);
    } finally {
      this.isLoadingTasks = false;
    }
  }

  /**
   * Retorna um mapa de chave-valor onde a chave é o nome de cada item de tarefa
   * e o valor é o label do grupo de categoria a que pertence.
   * @returns Um objeto mapeando nomes de itens a labels de categorias.
   */
  getCategoryMap(): { [itemName: string]: string } {
    const categoryMap: { [itemName: string]: string } = {};
    this.groupedTasks.forEach(group => {
      group.items.forEach(item => {
        categoryMap[item.value.toLowerCase()] = group.label;
      });
    });
    return categoryMap;
  }

  async addTask(): Promise<void> {
    // Certifica-se que o newTaskTitle é uma string aqui, caso o usuário tenha digitado um valor e não selecionado do autocomplete
    let finalTaskTitle: string;
    if (typeof this.newTaskTitle === 'object' && this.newTaskTitle !== null && 'value' in this.newTaskTitle) {
      finalTaskTitle = (this.newTaskTitle as TaskOption).value;
    } else if (typeof this.newTaskTitle === 'string') {
      finalTaskTitle = this.newTaskTitle;
    } else {
      finalTaskTitle = ''; // Fallback, shouldn't happen if validation is correct
    }

    if (!finalTaskTitle || !this.newTaskDateTime || !this.userId) {
      this.messageService.add({ severity: 'warn', summary: 'Atenção', detail: 'Preencha o título e a data/hora da tarefa.' });
      return;
    }

    // Determina a categoria para a nova tarefa usando o novo método
    const categoryMap = this.getCategoryMap();
    const taskCategory = categoryMap[finalTaskTitle.toLowerCase()] || undefined;
    console.log(`addTask: Título da Tarefa: "${finalTaskTitle}", Categoria Determinada: "${taskCategory}"`);


    const taskTime = this.newTaskDateTime.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    const maxOrderIndexForSelectedDay = this.currentTasks.length > 0
      ? Math.max(...this.currentTasks.map(t => t.orderIndex))
      : -1;
    const newOrderIndex = maxOrderIndexForSelectedDay + 1;

    const newTask: Task = {
      title: finalTaskTitle, // Usa o título final
      description: this.newTaskDescription,
      dateTime: this.newTaskDateTime,
      time: taskTime,
      priority: this.newTaskPriority,
      completed: false,
      userId: this.userId,
      originalDateTime: this.newTaskDateTime,
      orderIndex: newOrderIndex,
      category: taskCategory, // Atribui a categoria determinada aqui
    };

    try {
      const docRef = await addDoc(collection(this.firestore, 'tasks'), newTask);
      newTask.id = docRef.id;
      this.allTasks.push(newTask);
      this.allTasks.sort((a, b) => {
        const dateComparison = a.dateTime.getTime() - b.dateTime.getTime();
        if (dateComparison !== 0) return dateComparison;
        return a.orderIndex - b.orderIndex;
      });
      this.filterTasksBySelectedDay();
      this.resetNewTaskForm();
      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Tarefa adicionada!' });
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao adicionar tarefa: ${error.message}` });
      console.error("Erro ao adicionar tarefa:", error);
    }
  }

  async completeTask(task: Task): Promise<void> {
    if (!task.id) return;
    try {
      const taskRef = doc(this.firestore, 'tasks', task.id);
      await updateDoc(taskRef, { completed: !task.completed });
      task.completed = !task.completed;
      this.updateProgressBar();
      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: `Tarefa ${task.completed ? 'concluída' : 'reaberta'}!` });
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao atualizar tarefa: ${error.message}` });
      console.error("Erro ao concluir tarefa:", error);
    }
  }

  editTask(task: Task): void {
    // Fecha qualquer outra tarefa que possa estar em edição
    this.currentTasks.forEach(t => {
      if (t.isEditing && t.id !== task.id) {
        t.isEditing = false;
      }
    });

    task.isEditing = true;
    // Salva o título original caso o usuário cancele a categorização ou a edição
    task.originalDateTime = task.dateTime ? new Date(task.dateTime.getTime()) : new Date();
    // Limpa a flag de edição atual global (caso alguma categorização tenha sido iniciada e não concluída)
    this.currentEditingTask = null; // É importante que esta seja nula no início da edição de uma nova tarefa
  }

  cancelEdit(task: Task): void {
    task.isEditing = false;
    this.currentEditingTask = null; // Reseta a tarefa em edição
    this.fetchTasks(); // Recarrega as tarefas para reverter quaisquer alterações não salvas
  }

  async saveTask(task: Task): Promise<void> {
    if (!task.id) return;

    // Garante que o título é uma string antes de salvar, caso o autocomplete tenha um objeto temporário
    let finalTaskTitle: string;
    if (typeof task.title === 'object' && task.title !== null && 'value' in task.title) {
      finalTaskTitle = (task.title as TaskOption).value;
    } else if (typeof task.title === 'string') {
      finalTaskTitle = task.title;
    } else {
      finalTaskTitle = ''; // Fallback
    }

    // Determina a categoria para a tarefa editada usando o novo método
    const categoryMap = this.getCategoryMap();
    let taskCategory = categoryMap[finalTaskTitle.toLowerCase()];

    // Se não encontrou nos groupedTasks, mas a tarefa já tinha uma categoria, mantém a categoria existente
    if (!taskCategory && task.category) {
      taskCategory = task.category;
    }
    console.log(`saveTask: Título da Tarefa: "${finalTaskTitle}", Categoria Determinada: "${taskCategory}"`);


    task.time = task.originalDateTime ? task.originalDateTime.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '';
    task.dateTime = task.originalDateTime || new Date();

    try {
      const taskRef = doc(this.firestore, 'tasks', task.id);
      await updateDoc(taskRef, {
        title: finalTaskTitle, // Usa o título final
        description: task.description,
        priority: task.priority,
        dateTime: task.dateTime,
        time: task.time,
        category: taskCategory, // Salva a categoria aqui
      });
      task.isEditing = false;
      this.currentEditingTask = null; // Reseta a tarefa em edição após salvar

      this.allTasks.sort((a, b) => {
        const dateComparison = a.dateTime.getTime() - b.dateTime.getTime();
        if (dateComparison !== 0) return dateComparison;
        return a.orderIndex - b.orderIndex;
      });
      this.filterTasksBySelectedDay();
      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Tarefa atualizada!' });
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao salvar tarefa: ${error.message}` });
      console.error("Erro ao salvar tarefa:", error);
    }
  }

  // NOVO: Método para mover uma tarefa para o dia seguinte
  async moveTaskToNextDay(task: Task): Promise<void> {
    if (!task.id) return;

    const nextDay = new Date(task.dateTime);
    nextDay.setDate(nextDay.getDate() + 1);

    const taskTime = nextDay.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

    try {
      const taskRef = doc(this.firestore, 'tasks', task.id);
      await updateDoc(taskRef, {
        dateTime: nextDay,
        time: taskTime
      });

      task.dateTime = nextDay;
      task.time = taskTime;
      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: `Tarefa "${task.title}" movida para ${nextDay.toLocaleDateString()}!` });

      this.allTasks.sort((a, b) => {
        const dateComparison = a.dateTime.getTime() - b.dateTime.getTime();
        if (dateComparison !== 0) return dateComparison;
        return a.orderIndex - b.orderIndex;
      });
      this.filterTasksBySelectedDay();
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao mover tarefa: ${error.message}` });
      console.error("Erro ao mover tarefa para o dia seguinte:", error);
    }
  }

  // NOVO: Confirmação para deletar uma única tarefa
  confirmDeleteSingleTask(event: Event | null, task: Task) {
    this.confirmationService.confirm({
      message: `Tem a certeza que deseja eliminar a tarefa "${task.title}"? Esta ação não pode ser desfeita.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sim',
      rejectLabel: 'Não',
      accept: () => {
        this.removeTask(task);
      },
      reject: () => {
        this.messageService.add({ severity: 'info', summary: 'Cancelado', detail: 'A eliminação da tarefa foi cancelada.' });
      }
    });
  }

  // NOVO: Confirmação para deletar todas as tarefas do dia selecionado
  confirmDeleteAllTasksToday() {
    const dayName = this.selectedDay.toLowerCase();
    this.confirmationService.confirm({
      message: `Tem a certeza que deseja eliminar TODAS as tarefas de "${dayName}"? Esta ação é irreversível e não poderá recuperar as tarefas.`,
      header: 'Eliminar Todas as Tarefas do Dia',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sim, Eliminar Todas',
      rejectLabel: 'Não, Manter Tarefas',
      accept: () => {
        this.deleteAllTasksForSelectedDay();
      },
      reject: () => {
        this.messageService.add({ severity: 'info', summary: 'Cancelado', detail: `A eliminação das tarefas de "${dayName}" foi cancelada.` });
      }
    });
  }

  // NOVO: Método para deletar todas as tarefas do dia selecionado
  async deleteAllTasksForSelectedDay(): Promise<void> {
    if (!this.userId) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Utilizador não autenticado.' });
      return;
    }
    if (this.currentTasks.length === 0) {
      this.messageService.add({ severity: 'info', summary: 'Info', detail: `Não há tarefas para eliminar em "${this.selectedDay}".` });
      return;
    }

    const batch = writeBatch(this.firestore);
    const deletedTaskIds: string[] = [];

    this.currentTasks.forEach(task => {
      if (task.id) {
        batch.delete(doc(this.firestore, 'tasks', task.id));
        deletedTaskIds.push(task.id);
      }
    });

    try {
      await batch.commit();
      this.allTasks = this.allTasks.filter(task => !deletedTaskIds.includes(task.id!));
      this.filterTasksBySelectedDay();
      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: `Todas as tarefas de "${this.selectedDay}" foram eliminadas!` });
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao eliminar tarefas: ${error.message}` });
      console.error("Erro ao eliminar todas as tarefas do dia:", error);
    }
  }

  // NOVO: Confirmação para deletar todas as tarefas do utilizador
  confirmDeleteAllUserTasks() {
    this.confirmationService.confirm({
      message: 'Tem a certeza que deseja eliminar TODAS as suas tarefas? Esta ação é irreversível e não poderá recuperar nenhuma tarefa!',
      header: 'Eliminar TODAS as Tarefas',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sim, Eliminar TUDO',
      rejectLabel: 'Não, Manter Tarefas',
      accept: () => {
        this.deleteAllUserTasks();
      },
      reject: () => {
        this.messageService.add({ severity: 'info', summary: 'Cancelado', detail: 'A eliminação de todas as tarefas foi cancelada.' });
      }
    });
  }

  // NOVO: Método para deletar todas as tarefas do utilizador
  async deleteAllUserTasks(): Promise<void> {
    if (!this.userId) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Utilizador não autenticado.' });
      return;
    }
    if (this.allTasks.length === 0) {
      this.messageService.add({ severity: 'info', summary: 'Info', detail: 'Não há tarefas para eliminar.' });
      return;
    }

    const batch = writeBatch(this.firestore);
    const deletedTaskIds: string[] = [];

    this.allTasks.forEach(task => {
      if (task.id) {
        batch.delete(doc(this.firestore, 'tasks', task.id));
        deletedTaskIds.push(task.id);
      }
    });

    try {
      await batch.commit();
      this.allTasks = [];
      this.currentTasks = [];
      this.updateProgressBar();
      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Todas as suas tarefas foram eliminadas!' });
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao eliminar todas as tarefas: ${error.message}` });
      console.error("Erro ao eliminar todas as tarefas do utilizador:", error);
    }
  }

  // Método para remover uma única tarefa
  async removeTask(task: Task): Promise<void> {
    if (!task.id) return;
    try {
      await deleteDoc(doc(this.firestore, 'tasks', task.id));
      this.allTasks = this.allTasks.filter(t => t.id !== task.id);
      this.filterTasksBySelectedDay();
      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Tarefa eliminada!' });
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao eliminar tarefa: ${error.message}` });
      console.error("Erro ao remover tarefa:", error);
    }
  }

  // Métodos de reordenação (Drag & Drop)
  async drop(event: any): Promise<void> {
    moveItemInArray(this.currentTasks, event.previousIndex, event.currentIndex);
    await this.updateTaskOrder();
  }

  async updateTaskOrder(): Promise<void> {
    if (!this.userId) return;

    const batch = writeBatch(this.firestore);
    for (let i = 0; i < this.currentTasks.length; i++) {
      const task = this.currentTasks[i];
      if (task.id && task.orderIndex !== i) { // Only update if order has changed
        const taskRef = doc(this.firestore, 'tasks', task.id);
        batch.update(taskRef, { orderIndex: i });
        task.orderIndex = i; // Update local object immediately
      }
    }
    try {
      await batch.commit();
      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Ordem das tarefas atualizada!' });
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao atualizar ordem: ${error.message}` });
      console.error("Erro ao atualizar ordem das tarefas:", error);
    }
  }

  // Métodos de movimentação (botões)
  async moveTaskUp(task: Task): Promise<void> {
    const index = this.currentTasks.findIndex(t => t.id === task.id);
    if (index > 0) {
      moveItemInArray(this.currentTasks, index, index - 1);
      await this.updateTaskOrder();
    }
  }

  async moveTaskDown(task: Task): Promise<void> {
    const index = this.currentTasks.findIndex(t => t.id === task.id);
    if (index < this.currentTasks.length - 1) {
      moveItemInArray(this.currentTasks, index, index + 1);
      await this.updateTaskOrder();
    }
  }

  // Métodos de seleção de dia e filtragem de tarefas
  selectDay(day: string): void {
    this.selectedDay = day;
    this.filterTasksBySelectedDay();
    this.updateProgressBar();
    this.setNewTaskDateTimeBasedOnSelectedDay();
  }

  filterTasksBySelectedDay(): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const next7Days = new Date(today);
    next7Days.setDate(next7Days.getDate() + 7);

    switch (this.selectedDay) {
      case 'Hoje':
        this.currentTasks = this.allTasks.filter(task =>
          task.dateTime && this.isSameDay(new Date(task.dateTime), today)
        );
        break;
      case 'Amanhã':
        this.currentTasks = this.allTasks.filter(task =>
          task.dateTime && this.isSameDay(new Date(task.dateTime), tomorrow)
        );
        break;
      case 'Próximos 7 Dias':
        this.currentTasks = this.allTasks.filter(task =>
          task.dateTime && new Date(task.dateTime).getTime() >= today.getTime() && new Date(task.dateTime).getTime() <= next7Days.getTime()
        );
        break;
      default:
        this.currentTasks = [];
        break;
    }
    this.currentTasks.sort((a, b) => {
      const dateComparison = a.dateTime.getTime() - b.dateTime.getTime();
      if (dateComparison !== 0) return dateComparison;
      return a.orderIndex - b.orderIndex;
    });
  }

  setNewTaskDateTimeBasedOnSelectedDay(): void {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    switch (this.selectedDay) {
      case 'Hoje':
        this.newTaskDateTime = today;
        break;
      case 'Amanhã':
        this.newTaskDateTime = tomorrow;
        break;
      case 'Próximos 7 Dias':
        // Para "Próximos 7 Dias", definimos a data para hoje por padrão, mas o utilizador pode alterar.
        this.newTaskDateTime = today;
        break;
      default:
        this.newTaskDateTime = null;
        break;
    }
  }

  resetNewTaskForm(): void {
    this.newTaskTitle = '';
    this.newTaskDescription = '';
    this.newTaskPriority = 'Normal';
    this.setNewTaskDateTimeBasedOnSelectedDay(); // Reseta a data/hora para o dia selecionado
  }

  updateProgressBar(observer?: any): void {
    if (this.currentTasks.length === 0) {
      if (observer) observer.next(0);
      return;
    }
    const completedTasks = this.currentTasks.filter(task => task.completed).length;
    const progress = (completedTasks / this.currentTasks.length) * 100;
    if (observer) observer.next(progress);
  }

  // Método para remover um item do autocomplete (categoria ou tarefa comum)
  async removeAutoCompleteItem(itemToRemove: TaskOption, event: Event): Promise<void> {
    event.stopPropagation(); // Evita que o autocomplete seja selecionado
    console.log('Tentando remover item do autocomplete:', itemToRemove);

    this.confirmationService.confirm({
      message: `Tem a certeza que deseja remover "${itemToRemove.label}" das suas sugestões de tarefas?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sim',
      rejectLabel: 'Não',
      accept: async () => {
        let itemRemoved = false;
        for (const group of this.groupedTasks) {
          const initialLength = group.items.length;
          group.items = group.items.filter(item => item.value.toLowerCase() !== itemToRemove.value.toLowerCase());
          if (group.items.length < initialLength) {
            itemRemoved = true;
            break;
          }
        }

        if (itemRemoved) {
          await this.saveUserCategories(); // Salva as categorias atualizadas no Firestore
          this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: `"${itemToRemove.label}" removido das sugestões.` });
          this.searchGrouped({ query: this.newTaskTitle }); // Atualiza as sugestões do autocomplete
        } else {
          this.messageService.add({ severity: 'warn', summary: 'Atenção', detail: `"${itemToRemove.label}" não encontrado nas sugestões.` });
        }
      }
    });
  }

     get formattedNewTaskDateDisplay(): string {
     if (!this.newTaskDateTime) {
       return '';
     }
     return this.newTaskDateTime.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
   }
}

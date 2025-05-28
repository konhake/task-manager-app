// app.component.ts
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { provideAnimations } from '@angular/platform-browser/animations';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';

// PrimeNG
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
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { DialogModule } from 'primeng/dialog';

// Angular CDK
import { moveItemInArray, DragDropModule } from '@angular/cdk/drag-drop';

// Firebase
import { Auth, GoogleAuthProvider, signInWithPopup, signOut, user } from '@angular/fire/auth';
import { Firestore, collection, addDoc, query, where, getDocs, deleteDoc, doc, updateDoc, writeBatch } from '@angular/fire/firestore';
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
    ToastModule,
    DragDropModule,
    AutoCompleteModule,
    DialogModule,
    SpeedDialModule,
    ConfirmDialogModule,
    FloatLabelModule
  ],
  providers: [    provideAnimations(),
    MessageService,
    ConfirmationService],
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
                  (onSelect)="onNewTaskTitleSelect($event)" (onBlur)="onNewTaskTitleBlur($event)" 	 styleClass="custom-autocomplete"
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
              <div class="p-d-flex p-ai-center p-jc-between p-mb-3 progress-section-header"> <div class="p-text-lg p-text-bold">Progresso do Dia:</div>
                <div class="p-d-flex p-ai-center" style="flex-grow: 1;">
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
                                <div class="p-flex-grow-1" style="padding-bottom: 20px">
                                  <div style="display: flex;">
                                    <h4 class="p-m-0 task-title" [class.line-through]="task.completed" [ngStyle]="{'color': task.completed ? 'green' : 'black', 'padding-left': '0px', 'word-break': 'break-all', 'width': '170px'}">{{ task.title }}</h4>
                                    <span *ngIf="task.completed" style="margin-left: 10px; color: green;">(Concluída)</span>
                                  </div>
                                  <p-tag *ngIf="task.category" severity="contrast" [value]="task.category" styleClass="mb-2"></p-tag>
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
                    (onSelect)="onEditTaskTitleSelect(task, $event)" (onBlur)="onEditTaskTitleBlur(task, $event)" 	 styleClass="custom-autocomplete"
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
      min-width: 0;
      overflow-x: hidden;
    }

    .task-edit-block {
      padding-top: 20px;
      padding-left: 10px;
      padding-right: 10px;
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

    ::ng-deep .p-dialog-content {
      height: 300px;
    }

    ::ng-deep .custom-autocomplete.p-autocomplete.p-component.p-inputwrapper {
      width: 100%;
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
      min-width: 0;
    }

    .topbar-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      max-width: 1200px;
      min-width: 0;
      flex-wrap: nowrap;
    }

    .branding {
      display: flex;
      align-items: center;
      font-size: 1.5rem;
      font-weight: bold;
      min-width: 0;
      flex-shrink: 1;
    }

    .brand-icon {
      margin-right: 0.5rem;
      font-size: 1.8rem;
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 1rem;
      min-width: 0;
      flex-shrink: 1;
    }

    .user-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      margin-right: 0.75rem;
      border: 2px solid var(--primary-color-text, #ffffff);
      object-fit: cover;
      flex-shrink: 0;
    }

    .user-name {
      font-weight: 500;
      white-space: nowrap;
      @media screen and (max-width: 575px) {
        display: none;
      }
    }

    .login-prompt {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      padding: 0.5rem 0;
      min-width: 0;
    }

    .content-wrapper {
      flex-grow: 1;
      padding: 1rem;
      display: flex;
      justify-content: center;
      box-sizing: border-box;
      min-width: 0;
      overflow-x: hidden;
    }

    .app-layout {
      display: grid;
      width: 100%;
      max-width: 1200px;
      gap: 1.5rem;
      grid-template-areas:
        "form"
        "timeline";
      min-width: 0;
      display: flex;
      flex-direction: column;
    }

    .task-form-column {
      grid-area: form;
      min-width: 0;
    }

    .task-timeline-column {
      grid-area: timeline;
      min-width: 0;
    }

    @media screen and (min-width: 768px) {
      .content-wrapper {
        padding: 1.5rem;
      }

      .app-layout {
        gap: 2rem;
        grid-template-columns: 1fr 1.5fr;
        grid-template-areas: "form timeline";
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
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      min-width: 0;

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
      }
    }

    .day-selector {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      margin-bottom: 1.5rem;
      gap: 0.75rem;
      min-width: 0;
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
    }

    .p-button-outlined {
      padding: 0.6rem 1.2rem;
      font-size: 0.9rem;
      border-radius: var(--border-radius, 6px);
      transition: all 0.2s ease-in-out;
      border: 1px solid;
      flex-grow: 1;
      min-width: 90px;

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

      .pi {
        font-size: 1.2rem;
        color: var(--blue-600, #2196F3);
      }

      span {
        flex-basis: 100%;
        text-align: center;
        min-width: 0;
      }

      span:first-child {
        flex-basis: auto;
      }
    }

    .p-field {
      margin-bottom: 1.5rem;
      min-width: 0;
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
        min-width: 0;
        width: 100%;
      }

      .p-flex-grow-1 {
        flex-grow: 1;
        flex-basis: 0;
        min-width: 0;
        margin-right: 0.5rem;
        word-break: break-word;
        overflow-wrap: break-word;
        white-space: normal;
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
        overflow-wrap: break-word;
        min-width: 0;
        white-space: normal;
      }

      .line-through {
        text-decoration: line-through;
      }

      .p-text-sm {
        font-size: 0.85rem;
        margin-bottom: 0.75rem;
        word-break: break-word;
        overflow-wrap: break-word;
        min-width: 0;
        white-space: normal;
      }

      .task-description {
        margin-top: 0.75rem;
        font-size: 0.95rem;
        color: var(--text-color, #495057);
        line-height: 1.4;
        word-break: break-word;
        overflow-wrap: break-word;
        min-width: 0;
        white-space: normal;
      }

      .action-buttons {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        margin-left: auto;
        gap: 0.25rem;
        flex-shrink: 0;
        min-width: 0;
        flex-basis: auto;

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
      width: 100%;
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

    p-speeddial {
        position: absolute !important;
        top: 1rem;
        right: 1rem;
        z-index: 10;
        display: block !important; 
        margin: 0 !important;
        flex-shrink: 0 !important;
        width: auto !important;
        height: auto !important;
    }


    .progress-section-header {
      flex-wrap: wrap; 
      gap: 0.75rem;
    }

    .progress-section-header > div {
      flex-basis: auto;
      min-width: 0;
    }

    @media screen and (max-width: 575px) {
      .progress-section-header {
        justify-content: center;
        text-align: center;
      }
      .progress-section-header .p-text-lg {
        flex-basis: 100%;
        margin-bottom: 0.5rem;
      }
      .progress-section-header .p-d-flex.p-ai-center {
        flex-basis: 100%;
        justify-content: center;
      }
    }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);
  private messageService: MessageService = inject(MessageService);
  private confirmationService: ConfirmationService = inject(ConfirmationService);

  userLoggedIn: boolean = false;
  userName: string = 'Convidado';
  userPhotoUrl: string | null = null;
  userId: string | null = null;
  private userSubscription: Subscription | null = null;
  isLoadingAuth: boolean = true;

  days: string[] = ['Hoje', 'Amanhã', 'Próximos 7 Dias'];
  selectedDay: string = 'Hoje';
  currentTasks: Task[] = [];
  allTasks: Task[] = [];
  isLoadingTasks: boolean = false;

  newTaskTitle: string = '';
  newTaskDescription: string = '';
  newTaskDateTime: Date | null = null;
  newTaskPriority: 'Urgente' | 'Normal' | 'Baixa' = 'Normal';
  priorityOptions = [
    { label: 'Urgente', value: 'Urgente', icon: 'pi pi-exclamation-triangle', color: ' #ef4444' },
    { label: 'Normal', value: 'Normal', icon: 'pi pi-info-circle', color: ' #f97316' },
    { label: 'Baixa', value: 'Baixa', icon: 'pi pi-arrow-down', color: ' #2196F3' }
  ];

  defaultGroupedTasks: TaskGroup[] = [
    { label: 'Tarefas Comuns', value: 'tarefas-comuns', items: [{ label: 'Enviar email', value: 'Enviar email' }, { label: 'Reunião de equipe', value: 'Reunião de equipe' }, { label: 'Relatório mensal', value: 'Relatório mensal' }, { label: 'Fazer ligação', value: 'Fazer ligação' }] },
    { label: 'Atividades Diárias', value: 'atividades-diarias', items: [{ label: 'Verificar caixa de entrada', value: 'Verificar caixa de entrada' }, { label: 'Almoço', value: 'Almoço' }, { label: 'Planejar o dia seguinte', value: 'Planejar o dia seguinte' }, { label: 'Anotar ideias', value: 'Anotar ideias' }] },
    { label: 'Projetos', value: 'projetos', items: [{ label: 'Revisar código', value: 'Revisar código' }, { label: 'Escrever documentação', value: 'Escrever documentação' }, { label: 'Configurar ambiente', value: 'Configurar ambiente' }] }
  ];
  groupedTasks: TaskGroup[] = [];
  filteredGroupedTasks: TaskGroup[] = [];

  displayCategoryDialog: boolean = false;
  newlyAddedTaskValue: string = '';
  selectedCategoryForNewTask: any = null;
  availableCategories: SelectItem[] = [];

  todayMinDate: Date = new Date();

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

  private progressSubject = new BehaviorSubject<number>(0);
  progressValue$: Observable<number> = this.progressSubject.asObservable();

  private dailyTransitionDone: boolean = false;
  private isSelectionOccurring: boolean = false;

  currentEditingTask: Task | null = null;


  constructor() {}

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
    this.progressSubject.complete();
  }

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

        this.defaultGroupedTasks.forEach(defaultGroup => {
          this.groupedTasks.push(JSON.parse(JSON.stringify(defaultGroup)));
          defaultGroup.items.forEach(item => existingValues.add(item.value.toLowerCase()));
        });

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
        this.updateProgressBar();
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

  onNewTaskTitleSelect(event: any) {
    this.isSelectionOccurring = true;
    this.newTaskTitle = event.value?.value || event.value;
    setTimeout(() => { this.isSelectionOccurring = false; }, 50);
  }

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
      currentInputValue = '';
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
      this.selectedCategoryForNewTask = null;
      this.currentEditingTask = null;
      this.displayCategoryDialog = this.newlyAddedTaskValue === this.newTaskTitle;
    }, 100);
    } else {
      this.newTaskTitle = currentInputValue;
    }
  }

  onEditTaskTitleSelect(task: Task, event: any) {
    this.isSelectionOccurring = true;
    task.title = event.value?.value || event.value;
    setTimeout(() => { this.isSelectionOccurring = false; }, 50);
  }

  onEditTaskTitleBlur(task: Task, event: any) {
    if (this.isSelectionOccurring) {
      setTimeout(() => { this.isSelectionOccurring = false; }, 100);
      return;
    }

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
        this.selectedCategoryForNewTask = null;
        this.currentEditingTask = task;
        this.displayCategoryDialog = this.newlyAddedTaskValue === this.currentEditingTask.title;
      }, 100);
    } else {
      task.title = currentInputValue;
    }
  }

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
        if (!targetGroup.items.some(item => item.value.toLowerCase() === newTaskOption.value.toLowerCase())) {
          targetGroup.items.push(newTaskOption);
          console.log(`Nova sugestão "${newTaskOption.label}" adicionada ao grupo "${targetGroup.label}".`);
          await this.saveUserCategories();
        } else {
          this.messageService.add({severity: 'warn', summary: 'Atenção', detail: 'Essa sugestão já existe nesta categoria.'});
        }

        if (this.currentEditingTask) {
          this.currentEditingTask.title = newTaskOption.value; 
          this.currentEditingTask.category = targetGroup.label;
        } else {
          this.newTaskTitle = newTaskOption.value;
          this.searchGrouped({ query: this.newTaskTitle });
        }

      } else {
        console.warn('Grupo selecionado não encontrado para categorização.');
      }
      this.resetCategoryDialog();
    }
  }

  cancelCategorization() {
    if (this.currentEditingTask) return;
    this.resetCategoryDialog();
  }

  resetCategoryDialog() {
    this.displayCategoryDialog = false;
    this.newlyAddedTaskValue = '';
    this.selectedCategoryForNewTask = null;
    this.currentEditingTask = null;
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
          category: data['category'] || undefined,
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
      this.updateProgressBar();
      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Tarefas carregadas!' });
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao carregar tarefas: ${error.message}` });
      console.error("Erro ao carregar tarefas:", error);
    } finally {
      this.isLoadingTasks = false;
    }
  }

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
    let finalTaskTitle: string;
    if (typeof this.newTaskTitle === 'object' && this.newTaskTitle !== null && 'value' in this.newTaskTitle) {
      finalTaskTitle = (this.newTaskTitle as TaskOption).value;
    } else if (typeof this.newTaskTitle === 'string') {
      finalTaskTitle = this.newTaskTitle;
    } else {
      finalTaskTitle = '';
    }

    if (!finalTaskTitle || !this.newTaskDateTime || !this.userId) {
      this.messageService.add({ severity: 'warn', summary: 'Atenção', detail: 'Preencha o título e a data/hora da tarefa.' });
      return;
    }

    const categoryMap = this.getCategoryMap();
    const taskCategory = categoryMap[finalTaskTitle.toLowerCase()] || undefined;
    console.log(`addTask: Título da Tarefa: "${finalTaskTitle}", Categoria Determinada: "${taskCategory}"`);


    const taskTime = this.newTaskDateTime.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    const maxOrderIndexForSelectedDay = this.currentTasks.length > 0
      ? Math.max(...this.currentTasks.map(t => t.orderIndex))
      : -1;
    const newOrderIndex = maxOrderIndexForSelectedDay + 1;

    const newTask: Task = {
      title: finalTaskTitle,
      description: this.newTaskDescription,
      dateTime: this.newTaskDateTime,
      time: taskTime,
      priority: this.newTaskPriority,
      completed: false,
      userId: this.userId,
      originalDateTime: this.newTaskDateTime,
      orderIndex: newOrderIndex,
      category: taskCategory
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
      this.updateProgressBar();
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
    this.currentTasks.forEach(t => {
      if (t.isEditing && t.id !== task.id) {
        t.isEditing = false;
      }
    });

    task.isEditing = true;
    task.originalDateTime = task.dateTime ? new Date(task.dateTime.getTime()) : new Date();
    this.currentEditingTask = null;
  }

  cancelEdit(task: Task): void {
    task.isEditing = false;
    this.currentEditingTask = null;
    this.fetchTasks();
  }

  async saveTask(task: Task): Promise<void> {
    if (!task.id) return;

    let finalTaskTitle: string;
    if (typeof task.title === 'object' && task.title !== null && 'value' in task.title) {
      finalTaskTitle = (task.title as TaskOption).value;
    } else if (typeof task.title === 'string') {
      finalTaskTitle = task.title;
    } else {
      finalTaskTitle = '';
    }

    const categoryMap = this.getCategoryMap();
    let taskCategory = categoryMap[finalTaskTitle.toLowerCase()];

    if (!taskCategory && task.category) {
      taskCategory = task.category;
    }
    console.log(`saveTask: Título da Tarefa: "${finalTaskTitle}", Categoria Determinada: "${taskCategory}"`);


    task.time = task.originalDateTime ? task.originalDateTime.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '';
    task.dateTime = task.originalDateTime || new Date();

    try {
      const taskRef = doc(this.firestore, 'tasks', task.id);
      await updateDoc(taskRef, {
        title: finalTaskTitle,
        description: task.description,
        priority: task.priority,
        dateTime: task.dateTime,
        time: task.time,
        category: taskCategory,
      });
      task.isEditing = false;
      this.currentEditingTask = null;

      this.allTasks.sort((a, b) => {
        const dateComparison = a.dateTime.getTime() - b.dateTime.getTime();
        if (dateComparison !== 0) return dateComparison;
        return a.orderIndex - b.orderIndex;
      });
      this.filterTasksBySelectedDay();
      this.updateProgressBar();
      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Tarefa atualizada!' });
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao salvar tarefa: ${error.message}` });
      console.error("Erro ao salvar tarefa:", error);
    }
  }

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
      this.updateProgressBar();
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao mover tarefa: ${error.message}` });
      console.error("Erro ao mover tarefa para o dia seguinte:", error);
    }
  }

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
      this.updateProgressBar();
      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: `Todas as tarefas de "${this.selectedDay}" foram eliminadas!` });
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao eliminar tarefas: ${error.message}` });
      console.error("Erro ao eliminar todas as tarefas do dia:", error);
    }
  }

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

  async removeTask(task: Task): Promise<void> {
    if (!task.id) return;
    try {
      await deleteDoc(doc(this.firestore, 'tasks', task.id));
      this.allTasks = this.allTasks.filter(t => t.id !== task.id);
      this.filterTasksBySelectedDay();
      this.updateProgressBar();
      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Tarefa eliminada!' });
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao eliminar tarefa: ${error.message}` });
      console.error("Erro ao remover tarefa:", error);
    }
  }

  async drop(event: any): Promise<void> {
    moveItemInArray(this.currentTasks, event.previousIndex, event.currentIndex);
    await this.updateTaskOrder();
  }

  async updateTaskOrder(): Promise<void> {
    if (!this.userId) return;

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
      this.updateProgressBar();
      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Ordem das tarefas atualizada!' });
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao atualizar ordem: ${error.message}` });
      console.error("Erro ao atualizar ordem das tarefas:", error);
    }
  }

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
    this.setNewTaskDateTimeBasedOnSelectedDay();
  }

  updateProgressBar(): void {
    if (this.currentTasks.length === 0) {
      this.progressSubject.next(0);
      return;
    }
    const completedTasks = this.currentTasks.filter(task => task.completed).length;
    const progress = (completedTasks / this.currentTasks.length) * 100;
    this.progressSubject.next(Math.round(progress));
  }

  async removeAutoCompleteItem(itemToRemove: TaskOption, event: Event): Promise<void> {
    event.stopPropagation();
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
          await this.saveUserCategories();
          this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: `"${itemToRemove.label}" removido das sugestões.` });
          this.searchGrouped({ query: this.newTaskTitle });
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

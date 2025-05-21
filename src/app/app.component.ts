import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import { TimelineModule } from 'primeng/timeline';
import { InputTextModule } from 'primeng/inputtext';
import { FormsModule } from '@angular/forms';
import { StepperModule } from 'primeng/stepper';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { ProgressBarModule } from 'primeng/progressbar';
import { CalendarModule } from 'primeng/calendar';
import { PrimeNG } from 'primeng/config';
import { BehaviorSubject, Subscription } from 'rxjs';
import { FloatLabelModule } from 'primeng/floatlabel';
import { BadgeModule } from 'primeng/badge';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { DropdownModule } from 'primeng/dropdown';

// PrimeNG Skeleton Module para o loader
import { SkeletonModule } from 'primeng/skeleton';

// Importar os módulos de Drag and Drop do Angular CDK
import { CdkDragDrop, moveItemInArray, DragDropModule } from '@angular/cdk/drag-drop';

// Importar o AuthService
import { AuthService } from './services/auth.service';
import { User } from '@angular/fire/auth'; // Para tipagem do usuário

// Definir uma interface para a tarefa para tipagem mais clara
interface Task {
  title: string;
  time: string; // Manter como string formatada
  originalDateTime?: Date; // Para armazenar o objeto Date original para edição
  description?: string;
  priority?: 'Urgente' | 'Normal' | 'Baixa' | null;
  completed: boolean;
  isEditing: boolean; // Nova propriedade para controlar o modo de edição
  // Nova propriedade para armazenar uma cópia completa da tarefa antes da edição
  _originalTaskCopy?: Task;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    ButtonModule,
    DividerModule,
    TimelineModule,
    InputTextModule,
    FormsModule,
    StepperModule,
    ToggleButtonModule,
    ProgressBarModule,
    CalendarModule,
    FloatLabelModule,
    BadgeModule,
    OverlayBadgeModule,
    DropdownModule,
    DragDropModule,
    SkeletonModule // Adicionar SkeletonModule aqui
  ],
  template: `
    <div class="header">
      <div class="user-info" *ngIf="userLoggedIn">
        <img [src]="userPhotoUrl" *ngIf="userPhotoUrl" class="user-photo" alt="User Photo">
        <span>Olá, {{ userName }}!</span>
        <button pButton label="Sair" icon="pi pi-sign-out" (click)="logout()"></button>
      </div>
      <div *ngIf="!userLoggedIn">
        <button pButton label="Entrar com Google" icon="pi pi-google" (click)="login()"></button>
      </div>
    </div>

    <p-progressbar [value]="progressValue$ | async" />

    <ng-container *ngIf="isLoadingAuth; else appContent">
      <div class="skeleton-container">
        <p-skeleton width="100%" height="2rem" styleClass="mb-2"></p-skeleton>
        <p-skeleton width="75%" height="2rem" styleClass="mb-2"></p-skeleton>
        <p-skeleton width="90%" height="2rem" styleClass="mb-2"></p-skeleton>
        <p-card header="Carregando Conteúdo..." styleClass="main-card-skeleton">
          <p-skeleton height="2rem" styleClass="mb-2" />
          <p-skeleton height="2rem" styleClass="mb-2" />
          <p-skeleton height="2rem" styleClass="mb-2" />
          <p-skeleton height="10rem" styleClass="mb-2"></p-skeleton>
          <p-skeleton height="5rem"></p-skeleton>
        </p-card>
      </div>
    </ng-container>

    <ng-template #appContent>
      <div class="day-selector">
        <div *ngFor="let day of days; let i = index">
          <i [class.active]="day === selectedDay"
             (click)="selectDay(day)"
             class="day-button">
            {{ day }}
            <span class="priority-badge-container">
              <p-badge severity="danger" *ngIf="getPriorityCountForDay(day, 'Urgente') > 0" [value]="getPriorityCountForDay(day, 'Urgente')" />
              <p-badge severity="warn" *ngIf="getPriorityCountForDay(day, 'Normal') > 0" [value]="getPriorityCountForDay(day, 'Normal')" />
              <p-badge severity="info" *ngIf="getPriorityCountForDay(day, 'Baixa') > 0" [value]="getPriorityCountForDay(day, 'Baixa')" />
            </span>
          </i>
        </div>
      </div>

      <p-card [header]="'Tarefas para ' + (selectedDay === 'Sab' ? 'Sábado' : selectedDay === 'Dom' ? 'Domingo' : selectedDay + ' feira')" class="main-card">
        <div class="toggle-container">
          <p-toggleButton
          [(ngModel)]="showTimeline"
          onLabel=""
          offLabel=""
          onIcon="pi pi-list"
          offIcon="pi pi-list-check"
          styleClass="w-full" />
        </div>
        <div class="add-task-form">
          <input type="text" [(ngModel)]="newTaskTitle" placeholder="Nova tarefa" pInputText />
          <p-floatLabel class="full-width-mobile">
            <p-calendar [(ngModel)]="newTaskDateTime" [readonlyInput]="true" inputId="calendar-24h" [hourFormat]="'24'" [showTime]="true" [showButtonBar]="false" [locale]="calendar_pt" appendTo="body" placeholder="dia/mês/ano - hora:minutos"></p-calendar>
            <label for="calendar-24h">Data - Hora</label>
          </p-floatLabel>
          <button pButton label="" icon="pi pi-plus"
          (click)="addTask()" [disabled]="!newTaskTitle || !newTaskDateTime" class="new-task-button"></button>
        </div>
        <div class="add-task-form-details" [ngStyle]="{'display': showTimeline ? 'none' : 'flex'}">
          <input type="text" [(ngModel)]="newTaskDescription" placeholder="Descrição" pInputText />
          <p-dropdown [options]="priorityOptions" [(ngModel)]="newTaskPriority" placeholder="Prioridade" optionLabel="label" optionValue="value" class="p-inputtext" />
        </div>

        <ng-container *ngIf="showTimeline; else stepperView">
          <p-timeline [value]="currentTasks" layout="vertical" styleClass="customized-timeline" cdkDropList (cdkDropListDropped)="drop($event)">
            <ng-template pTemplate="content" let-task let-index="index">
              <div class="task-item" [class.completed-task]="task.completed" cdkDrag>
                <div class="timeline-content">
                  <div class="timeline-title-priority-badge-content">
                    <strong>{{ task.title }}</strong>
                    <div class="task-priority-badge">
                      <p-badge severity="info" *ngIf="task.priority === 'Baixa'" value= "Baixa" />
                      <p-badge severity="warn" *ngIf="task.priority === 'Normal'" value= "Normal"  />
                      <p-badge severity="danger" *ngIf="task.priority === 'Urgente'" value= "Urgente"  />
                      <p-badge severity="success" *ngIf="task.completed" class="completed-badge" value="Concluída"/>
                    </div>
                  </div>
                  <p>{{ task.time }}</p>
                </div>
                <div class="timeline-task-actions">
                  <p-button *ngIf="index > 0" i  (onClick)="moveTask(index, -1)" severity="secondary" title="Mover para Cima" styleClass="p-button-sm" />
                  <p-button *ngIf="index < currentTasks.length - 1" icon="pi pi-arrow-down" (onClick)="moveTask(index, 1)" severity="secondary" title="Mover para Baixo" styleClass="p-button-sm" />
                  <button pButton icon="pi pi-trash" class="p-button-text p-button-danger task-delete-button"
                          (click)="removeTask(task)"></button>
                </div>
              </div>
            </ng-template>
          </p-timeline>
        </ng-container>

        <ng-template #stepperView>
          <p-stepper [value]="activeStepIndex" orientation="vertical" (onActivate)="updateActiveStepAndProgressBar($event)" cdkDropList (cdkDropListDropped)="drop($event)">
            <p-step-item *ngFor="let task of currentTasks; let i = index" [value]="i">
              <p-step [class.completed-step-title]="task.completed">
                <div class="stepper-task-header" cdkDrag>
                  {{ task.title }} - {{ task.time }}
                  <i *ngIf="task.completed" class="pi pi-check" style="color: #10B981"></i>
                </div>
              </p-step>
              <p-step-panel>
                <ng-template #content let-activateCallback="activateCallback">
                  <div class="step-panel-content">
                    <ng-container *ngIf="!task.isEditing">
                      <p-badge severity="success" value="Concluída" *ngIf="task.completed" class="completed-badge-stepper" />
                      <ng-container *ngIf="!task.description">
                        <p><strong>Hora:</strong> {{ task.time }}</p>
                        <p><strong>Tarefa:</strong> {{ task.title }}</p>
                      </ng-container>

                      <ng-container *ngIf="task.description">
                        <p><strong>Hora:</strong> {{ task.time }}</p>
                        <p><strong>Tarefa:</strong> {{ task.title }}</p>
                        <p><strong>Descrição:</strong> {{ task.description }}</p>
                      </ng-container>
                      <p>
                        <strong *ngIf="task.priority" style="padding-right: 5px">Prioridade:</strong>
                        <p-badge severity="info" *ngIf="task.priority === 'Baixa'" value="Baixa" />
                        <p-badge severity="warn" *ngIf="task.priority === 'Normal'" value="Normal" />
                        <p-badge severity="danger" *ngIf="task.priority === 'Urgente'" value="Urgente" />
                      </p>
                    </ng-container>

                    <ng-container *ngIf="task.isEditing">
                      <div class="edit-fields">
                        <p-floatLabel>
                          <p-calendar [(ngModel)]="task.originalDateTime" [readonlyInput]="true" inputId="edit-calendar-{{i}}" [hourFormat]="'24'" [showTime]="true" [showButtonBar]="false" [locale]="calendar_pt" appendTo="body"></p-calendar>
                          <label for="edit-calendar-{{i}}">Data - Hora</label>
                        </p-floatLabel>
                        <input type="text" [(ngModel)]="task.title" placeholder="Tarefa" pInputText />
                        <input type="text" [(ngModel)]="task.description" placeholder="Descrição" pInputText />
                        <p-dropdown [options]="priorityOptions" [(ngModel)]="task.priority" placeholder="Prioridade" optionLabel="label" optionValue="value" class="p-inputtext" />
                      </div>
                    </ng-container>

                    <div class="p-button-danger-block">
                      <button pButton icon="pi pi-trash" class="p-button-text p-button-danger"
                      (click)="removeTask(task)"></button>
                    </div>
                  </div>
                  <div class="step-actions">
                    <p-button *ngIf="i > 0" i  icon="pi pi-arrow-up" (onClick)="moveTask(i, -1)" severity="secondary" title="Mover para Cima" />
                    <p-button *ngIf="i < currentTasks.length - 1" icon="pi pi-arrow-down" (onClick)="moveTask(i, 1)" severity="secondary" title="Mover para Baixo" />

                    <p-button *ngIf="i > 0" label="Anterior" severity="secondary" (onClick)="activateCallback(i - 1);" />
                    <p-button *ngIf="i < currentTasks.length - 1 && !task.isEditing" label="Próxima" (onClick)="activateCallback(i + 1);" />

                    <ng-container *ngIf="!task.isEditing">
                      <p-button label="Editar" (onClick)="editTask(task)" severity="info" />
                      <p-button label="Concluir" (onClick)="completeTask(task, activateCallback, i)" [disabled]="task.completed" class="ml-auto" />
                    </ng-container>
                    <ng-container *ngIf="task.isEditing">
                      <p-button label="Cancelar" (onClick)="cancelEdit(task)" severity="warn" />
                      <p-button label="Guardar" (onClick)="saveTask(task, activateCallback, i)" severity="success" class="ml-auto" />
                    </ng-container>
                  </div>
                </ng-template>
              </p-step-panel>
            </p-step-item>
          </p-stepper>
        </ng-template>
      </p-card>
    </ng-template>
  `,
  styles: [`
    /* ESTILOS GLOBAIS E BACKGROUND */
    :host {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        background: linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 100%);
        padding: 1rem; /* Base padding for mobile */
        box-sizing: border-box;
        font-family: 'Inter', sans-serif;
        color: #1E293B;
        transition: background 0.3s ease-in-out;
        width: 100%; /* Ensure host takes full width */
        overflow-x: hidden; /* Prevent horizontal scroll from host */
    }

    .app-progressbar {
        height: 8px !important;
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 1rem;
    }
    ::ng-deep .app-progressbar .p-progressbar-value {
        background-color: #6366F1 !important;
        transition: width 0.3s ease-in-out;
    }

    /* HEADER APERFEIÇOADO */
    .header {
        display: flex;
        justify-content: space-between; /* Space between user info and buttons */
        align-items: center;
        padding: 1rem;
        background-color: #FFFFFF;
        border-radius: 12px;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
        margin-bottom: 1.5rem;
        transition: all 0.3s ease-in-out;
        flex-wrap: wrap; /* Allow wrapping */
        gap: 0.75rem; /* Reduced gap for mobile */
    }
    .user-info {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-grow: 1; /* Allow user info to grow */
        min-width: 120px; /* Ensure user info doesn't collapse too much */
        justify-content: space-between;
    }
    .user-photo {
        width: 40px; /* Slightly smaller photo for mobile */
        height: 40px;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid #6366F1;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
        transition: transform 0.2s ease-in-out;
        flex-shrink: 0; /* Prevent shrinking */
    }
    .user-photo:hover {
        transform: scale(1.05);
    }
    .user-name {
        font-weight: 600;
        color: #1E293B;
        white-space: nowrap; /* Prevent name from breaking */
        overflow: hidden;
        text-overflow: ellipsis; /* Add ellipsis if too long */
    }
    button.new-task-button.p-button.p-component.p-button-icon-only {
      width: 100%;
    }
    .header-buttons {
      display: flex;
      gap: 0.5rem; /* Space between buttons */
      flex-wrap: nowrap; /* Keep buttons in a single line if possible */
      flex-shrink: 0;
    }
    .header button {
        padding: 0.6rem 1rem; /* Smaller padding for mobile buttons */
        border-radius: 8px;
        font-weight: 500;
        transition: all 0.2s ease-in-out;
        flex-shrink: 0;
        min-width: fit-content; /* Ensure text fits */
    }
    .header button:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }

    /* SKELETON LOADER APRIMORADO */
    .skeleton-container {
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-top: 1rem;
    }
    .main-card-skeleton {
        margin-top: 1rem;
        border-radius: 12px;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
    }
    ::ng-deep .p-skeleton {
        border-radius: 8px;
        background-color: #E2E8F0;
        animation: pulse 1.5s infinite ease-in-out;
    }
    @keyframes pulse {
        0% { opacity: 0.7; }
        50% { opacity: 0.3; }
        100% { opacity: 0.7; }
    }

    /* DAY SELECTOR REPAGINADO (QUEBRA DE LINHA PERMITIDA) */
    .day-selector-container {
        padding-bottom: 0.5rem;
        margin-bottom: 1.5rem;
    }
    .day-selector {
        display: flex;
        gap: 0.5rem; /* Reduced gap for mobile */
        padding: 0.5rem 0;
        justify-content: center; /* Center align buttons */
        flex-wrap: wrap; /* Allow wrapping onto multiple lines */
    }

    .day-button {
        background-color: #F8FAFC;
        border: 1px solid #E2E8F0;
        padding: 0.6rem 0.9rem; /* Smaller padding */
        border-radius: 25px;
        font-style: normal !important;
        cursor: pointer;
        position: relative;
        display: flex;
        align-items: center;
        gap: 6px; /* Smaller gap for badges */
        color: #1E293B;
        white-space: nowrap; /* Prevents text from breaking within a button */
        transition: all 0.3s ease-in-out;
        font-weight: 500;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
        flex-shrink: 0; /* Prevents buttons from shrinking too much */
        font-size: 0.9rem; /* Slightly smaller font size */
    }

    .day-button:hover {
        background-color: #E2E8F0;
        transform: translateY(-3px);
        box-shadow: 0 6px 12px rgba(0, 0, 0, 0.1);
    }

    .day-button.active {
        background-color: #6366F1 !important;
        color: white !important;
        font-weight: 600 !important;
        border-color: #6366F1 !important;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
        transform: translateY(-2px);
    }
    .day-button.active:hover {
        background-color: #8183F6 !important;
        color: white !important;
    }

    .priority-badge-container {
        display: flex;
        gap: 3px; /* Smaller gap */
        margin-left: 3px;
    }
    ::ng-deep .day-button .p-badge {
        min-width: 16px; /* Smaller badge */
        height: 16px;
        font-size: 0.7rem; /* Smaller font */
        line-height: 16px;
        border: 1px solid #FFFFFF;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }
    ::ng-deep .day-button .p-badge.p-badge-danger { background-color: #EF4444; }
    ::ng-deep .day-button .p-badge.p-badge-warning { background-color: #FBBF24; }
    ::ng-deep .day-button .p-badge.p-badge-info { background-color: #3B82F6; }
    ::ng-deep .day-button .p-overlay-badge .p-badge {
        background-color: #1E293B;
        min-width: 1rem; /* Adjusted for smaller badge */
        height: 1rem;
        line-height: 1rem;
        font-size: 0.6rem;
    }

    /* CARD PRINCIPAL */
    p-card {
        border-radius: 16px !important;
        box-shadow: 0 6px 15px rgba(0, 0, 0, 0.1) !important;
        background-color: #FFFFFF !important;
        padding: 1.25rem !important; /* Slightly less padding for mobile */
        transition: all 0.3s ease-in-out;
        flex-grow: 1;
        margin-top: 1rem;
        height: auto !important; /* Remove fixed height, allow content to dictate */
        min-height: auto !important;
    }
    ::ng-deep .p-card .p-card-header,
    ::ng-deep .p-card .p-card-title {
        font-size: 1.4rem; /* Adjusted font size */
        font-weight: 700;
        color: #6366F1;
        margin-bottom: 1.25rem; /* Adjusted margin */
        text-align: center;
    }
    ::ng-deep .p-card .p-card-content {
        padding: 0 !important;
    }


    /* FORM FIELDS AND BUTTONS */
    .add-task-form {
        display: flex;
        flex-direction: column; /* Default to column for mobile */
        gap: 1.60rem; /* Reduced gap */
        margin-bottom: 1.5rem;
        animation: fadeIn 0.5s ease-in-out;
    }
    .add-task-form-details {
        display: flex;
        flex-direction: column; /* Default to column for mobile */
        gap: 1.60rem; /* Reduced gap */
        margin-bottom: 1.5rem;
        animation: fadeIn 0.5s ease-in-out;
    }


    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }

    /* Universal styling for PrimeNG inputs for responsiveness */
    ::ng-deep .p-inputtext,
    ::ng-deep .p-dropdown,
    ::ng-deep .p-calendar .p-inputtext {
        width: 100% !important; /* Crucial for full width on mobile */
        box-sizing: border-box !important; /* Include padding/border in width */
        //padding: 0.8rem 1rem !important;
        font-size: 1rem !important;
        border-radius: 8px !important;
        border: 1px solid #E2E8F0 !important;
        box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);
        transition: all 0.3s ease-in-out;
        height: 40px !important;
        .p-select-label {
          padding: 0px !important;
      }
    }
    ::ng-deep .p-inputtext:focus,
    ::ng-deep .p-dropdown:focus, ::ng-deep .p-dropdown.p-focus,
    ::ng-deep .p-calendar .p-inputtext:focus {
        border-color: #6366F1 !important;
        box-shadow: 0 0 0 0.2rem rgba(99, 102, 241, 0.25) !important;
    }

    ::ng-deep .p-select-label {
      //padding: 0px;
    }

    ::ng-deep .p-floatlabel label {
      color: #1E293B !important;
      transition: all 0.2s ease-in-out;
    }
    ::ng-deep .p-floatlabel input:focus ~ label,
    ::ng-deep .p-floatlabel input.p-filled ~ label,
    ::ng-deep .p-floatlabel .p-inputwrapper-focus ~ label,
    ::ng-deep .p-floatlabel .p-inputwrapper-filled ~ label {
      color: #6366F1 !important;
    }

    /* Specific adjustments for form elements */
    .add-task-form .p-floatlabel {
        flex-grow: 1; /* Allow input to grow */
    }
    .add-task-form-details .p-floatlabel {
        flex-grow: 1; /* Allow input to grow */
    }

    .add-task-form-row {
      display: flex;
      flex-direction: column; /* Default to column for mobile */
      gap: 0.75rem;
      width: 100%;
    }

    .add-task-form ::ng-deep .p-button-success.p-button-rounded {
        width: 48px; /* Slightly smaller button for mobile */
        height: 48px;
        min-width: 48px;
        border-radius: 50%;
        font-size: 1.4rem; /* Adjusted font size */
        box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3);
        transition: all 0.2s ease-in-out;
        align-self: center; /* Center horizontally for mobile */
        margin: 0.5rem auto; /* Center button */
    }
    .add-task-form ::ng-deep .p-button-success.p-button-rounded:hover {
        transform: scale(1.05) translateY(-2px);
        box-shadow: 0 6px 15px rgba(16, 185, 129, 0.4);
    }

    /* Toggle button specific styles */
    .toggle-visual {
      width: 100%; /* Ensure toggle takes full width on mobile */
      display: flex;
      justify-content: center;
      margin-top: 0.5rem; /* Space from previous field */
    }
    .toggle-visual ::ng-deep .p-togglebutton {
        border-radius: 8px !important;
        font-weight: 500;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
        background-color: #FFFFFF;
        color: #1E293B;
        border-color: #E2E8F0;
        width: 100%; /* Full width */
        max-width: 250px; /* Max width to prevent it from being too wide on large screens */
        display: block; /* Ensures it takes full width */
    }
    .toggle-visual ::ng-deep .p-togglebutton.p-highlight {
        background-color: #6366F1 !important;
        border-color: #6366F1 !important;
        color: white !important;
    }
    .toggle-container {
      width: 100% !important;
      display: flex;
      justify-content: center;
      margin-bottom: 25px;
    }


    /* TIMELINE APRIMORADA */
    ::ng-deep .customized-timeline {
        padding: 0.5rem 0;
    }
    .task-item {
        background-color: #FFFFFF;
        border: 1px solid #E2E8F0;
        border-radius: 10px;
        padding: 1rem;
        margin-bottom: 0.75rem;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        transition: all 0.3s ease-in-out;
        cursor: grab;
        position: relative;
        overflow: hidden;
        display: flex;
        flex-direction: column; /* Stack vertically for mobile */
        gap: 0.5rem; /* Closer spacing */
        align-items: flex-start; /* Align content to start */
    }
    .task-item:hover {
        transform: translateY(-3px) scale(1.01);
        box-shadow: 0 5px 12px rgba(0, 0, 0, 0.1);
    }
    .task-item.completed-task {
        opacity: 0.8;
        background-color: #E2E8F0;
        box-shadow: none;
    }
    .task-item.completed-task .task-title-text {
        text-decoration: line-through;
        color: #1E293B;
    }
    .task-item.completed-task .task-time-text {
      color: #1E293B;
    }

    .timeline-content {
        display: flex;
        flex-direction: column; /* Stack vertically for mobile */
        width: 100%;
        gap: 0.25rem; /* Even closer spacing for content */
    }
    .timeline-primary-info {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem; /* Space between title, time, and priority dot */
      width: 100%;
    }
    .task-title-text {
        font-size: 1.1rem; /* Slightly smaller for mobile */
        font-weight: 600;
        color: #1E293B;
        flex-grow: 1; /* Allow title to grow */
        word-break: break-word; /* Allow long titles to break words */
    }
    .task-time-text {
        font-size: 0.85rem; /* Slightly smaller */
        color: #1E293B;
        white-space: nowrap; /* Prevent time from breaking */
        flex-shrink: 0; /* Prevent shrinking */
        text-align: right; /* Align to right */
        margin-left: auto; /* Push to right */
    }

    .priority-dot {
        min-width: 12px !important;
        height: 12px !important;
        padding: 0 !important;
        font-size: 0 !important;
        border-radius: 50% !important;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        display: inline-block;
        flex-shrink: 0; /* Prevent dot from shrinking */
    }
    .priority-dot.p-badge-danger { background-color: #EF4444; }
    .priority-dot.p-badge-warning { background-color: #FBBF24; }
    .priority-dot.p-badge-info { background-color: #3B82F6; }

    .task-description {
        font-size: 0.7rem;
        color: #475569;
        margin-top: 0.25rem;
        word-break: break-word;
    }

    .completed-badge {
        position: absolute;
        top: 0.75rem; /* Position from top */
        right: 0.75rem; /* Position from right */
        font-size: 0.7rem;
        padding: 0.2em 0.5em;
        border-radius: 5px;
        background-color: #10B981;
        color: white;
        z-index: 5;
        white-space: nowrap;
    }

    .timeline-task-actions {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.75rem; /* Space from content */
        width: 100%; /* Take full width */
        justify-content: flex-end; /* Align buttons to the right */
        align-items: center; /* Vertically align buttons */
    }
    ::ng-deep .timeline-task-actions button.p-button-sm {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        font-size: 1rem;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
        flex-shrink: 0; /* Prevent shrinking */
    }
    ::ng-deep .timeline-task-actions button.p-button-sm:hover {
        transform: scale(1.1);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }

    .task-delete-button {
      color: #EF4444 !important;
      font-size: 1.3rem !important;
      transition: transform 0.2s ease-in-out;
      background: none !important;
      border: none !important;
      box-shadow: none !important;
      margin-left: auto; /* Push to the right */
    }
    .task-delete-button:hover {
      transform: scale(1.1);
      color: #EF4444 !important;
    }
    span.p-button-icon.pi.pi-trash {
        color: #EF4444;
        font-size: 1.3rem;
        transition: color 0.2s ease-in-out;
    }
    span.p-button-icon.pi.pi-trash:hover {
        color: #EF4444;
    }


    /* REMOVE STANDARD PRIMENG STYLING FOR CONNECTORS/MARKERS IN TIMELINE */
    ::ng-deep .p-timeline-event-connector,
    ::ng-deep .p-timeline-event-marker {
        display: none !important;
    }
    ::ng-deep .p-timeline-event-content {
        padding-left: 0 !important;
    }
    ::ng-deep .p-timeline-event-opposite {
        display: none;
    }
    ::ng-deep .p-timeline-event {
        padding-bottom: 0.5rem;
    }

    /* STEPPER APRIMORADO */
    ::ng-deep .p-stepper {
        background: transparent !important;
        border: none !important;
    }
    ::ng-deep .p-stepper-panel {
        background-color: #FFFFFF;
        border: 1px solid #E2E8F0;
        border-radius: 12px;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
        margin-bottom: 1rem;
        transition: all 0.3s ease-in-out;
    }
    ::ng-deep .p-stepper-panel.p-stepper-active {
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
        transform: translateY(-2px);
    }

    ::ng-deep .p-stepper-panel .p-stepper-header {
      padding: 1rem; /* Adjusted padding */
      border-bottom: 1px solid #E2E8F0;
      background-color: #FFFFFF;
      border-radius: 12px 12px 0 0;
      cursor: grab;
      display: flex; /* Ensure flex for header */
      justify-content: space-between; /* Space out title and completed badge */
      align-items: center;
    }
    ::ng-deep .p-stepper-panel .p-stepper-title {
        font-size: 1.1rem; /* Adjusted font size */
        font-weight: 600;
        color: #1E293B;
        transition: all 0.3s ease-in-out;
        flex-grow: 1; /* Allow title to grow */
        word-break: break-word; /* Allow long titles to break words */
        margin-right: 0.5rem; /* Space from badge */
    }
    ::ng-deep .p-stepper-panel .p-stepper-title.completed-step-title {
        text-decoration: line-through;
        color: #1E293B;
    }
    ::ng-deep p-stepper-item:last-of-type .p-stepper-separator {
      display: none !important;
    }


    .step-panel-content {
      padding: 1.25rem; /* Adjusted padding */
      background: #F8FAFC;
      border-radius: 0 0 12px 12px;
      position: relative;
      display: flex;
      flex-direction: column; /* Mobile-first: column */
      //gap: 0.75rem; /* Adjusted gap */
    }
    .step-panel-content p {
        font-size: 0.7rem; /* Adjusted font size */
        color: #1E293B;
    }
    .step-panel-content strong {
        color: #6366F1;
    }

    .priority-display ::ng-deep .p-badge {
        font-size: 0.75rem; /* Adjusted font size */
        padding: 0.25em 0.5em; /* Adjusted padding */
        border-radius: 8px;
        font-weight: 600;
        flex-shrink: 0; /* Prevent shrinking */
    }
    .completed-badge-stepper {
        position: static; /* Change to static for inline display */
        font-size: 0.65rem; /* Smaller font */
        padding: 0.15em 0.4em; /* Smaller padding */
        border-radius: 5px;
        background-color: #10B981;
        color: white;
        margin-left: auto; /* Push to the right */
        flex-shrink: 0; /* Prevent shrinking */
        white-space: nowrap; /* Prevent text wrapping */
    }

    .edit-fields {
        display: flex;
        flex-direction: column; /* Mobile-first: column */
        gap: 0.75rem;
        margin-bottom: 1rem;
    }

    .step-actions {
        display: flex;
        justify-content: flex-end;
        flex-wrap: wrap; /* Allow wrapping */
        margin-top: 1rem;
        gap: 0.75rem; /* Adjusted gap */
        width: 100%; /* Take full width on mobile */
    }
    ::ng-deep .step-actions button {
        padding: 0.6rem 1rem; /* Smaller padding for mobile buttons */
        border-radius: 8px;
        font-weight: 500;
        transition: all 0.2s ease-in-out;
        flex-grow: 1; /* Allow buttons to grow to fill space */
        min-width: fit-content; /* Ensure text fits */
    }
    ::ng-deep .step-actions button:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }

    .step-panel-content .p-button.p-button-danger {
        color: #EF4444;
        background: none;
        border: none;
        box-shadow: none;
        padding: 0.5rem;
        font-size: 1.2rem;
        transition: background-color 0.2s ease-in-out;
    }
    .step-panel-content .p-button.p-button-danger:hover {
        background-color: #FEF2F2;
    }
    .p-button-danger-block {
      display: flex !important;
      width: 100% !important;
      justify-content: flex-end; /* Align delete button to the right */
    }
    .p-button-text.p-button-danger {
      margin-left: auto !important;
    }


    /* DRAG AND DROP VISUALS (CDK Drag and Drop) */
    .cdk-drag-preview {
      box-sizing: border-box;
      border-radius: 10px;
      box-shadow: 0 8px 15px rgba(0, 0, 0, 0.15);
      background-color: #8183F6;
      color: white;
      padding: 1rem;
      border: 2px solid #6366F1;
      z-index: 1000;
      transform: rotate(2deg) scale(1.02);
      transition: transform 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
      max-width: 90vw; /* Limit drag preview width */
    }
    .cdk-drag-preview .task-title-text, .cdk-drag-preview .task-time-text {
        color: white !important;
    }
    .cdk-drag-placeholder {
      opacity: 0.4;
      background: #E2E8F0;
      border: dashed 2px #6366F1;
      min-height: 60px;
      border-radius: 10px;
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }
    .cdk-drag-animating {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }

    .customized-timeline.cdk-drop-list-dragging .task-item:not(.cdk-drag-placeholder),
    ::ng-deep p-stepper.cdk-drop-list-dragging .p-stepper-panel:not(.cdk-drag-placeholder) {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }
    .stepper-task-header {
      width: 100%;
      cursor: grab;
      padding: 0.5rem 0;
    }

    /* Primeng Overrides (Z-index, Calendar, Dropdown) - General */
    ::ng-deep .p-datepicker {
      z-index: 10000 !important;
      max-width: 98vw; /* Wider max-width for datepicker */
      box-sizing: border-box;
    }
    ::ng-deep .p-datepicker-mask {
      z-index: 9999 !important;
    }
    ::ng-deep .p-dropdown-panel {
        max-width: 98vw; /* Wider max-width for dropdowns */
        box-sizing: border-box;
    }


    /* Media Queries for Tablets and Desktops (Larger Screens) */
    @media (min-width: 768px) {
      :host {
        padding: 2rem;
      }

      .header {
        padding: 1.25rem 2rem;
        flex-wrap: nowrap; /* Prevent wrapping on larger screens */
        gap: 1.5rem; /* More space on desktop */
      }
      .user-info {
        margin-right: 0; /* Remove auto-margin */
      }
      .user-photo {
        width: 48px; /* Restore desktop photo size */
        height: 48px;
      }
      .header-buttons {
        gap: 1rem;
      }
      .header button {
        padding: 0.75rem 1.25rem; /* Restore desktop padding */
      }

      .day-selector-container {
        padding-bottom: 0;
      }
      .day-selector {
        justify-content: center;
        flex-wrap: nowrap; /* Prevent wrapping on desktop */
        gap: 0.75rem; /* Restore desktop gap */
      }
      .day-button {
        padding: 0.6rem 1.2rem; /* Restore desktop padding */
        font-size: 1rem; /* Restore desktop font size */
        gap: 8px; /* Restore desktop gap */
        flex-shrink: 1; /* Allow to shrink a bit if needed */
      }
      ::ng-deep .day-button .p-badge {
        min-width: 18px; /* Restore desktop badge size */
        height: 18px;
        font-size: 0.75rem; /* Restore desktop font size */
        line-height: 18px;
        gap: 4px; /* Restore desktop gap */
      }
      ::ng-deep .day-button .p-overlay-badge .p-badge {
        min-width: 1.2rem; /* Restore desktop badge size */
        height: 1.2rem;
        line-height: 1.2rem;
        font-size: 0.7rem;
      }

      p-card {
        padding: 1.5rem !important; /* Restore desktop padding */
        height: auto !important; /* Ensure no fixed height */
        min-height: auto !important;
      }
      ::ng-deep .p-card .p-card-title {
        font-size: 1.5rem; /* Restore desktop font size */
        margin-bottom: 1.5rem; /* Restore desktop margin */
      }

      .add-task-form {
        flex-direction: row; /* Desktop: row */
        align-items: center;
        flex-wrap: nowrap;
        gap: 1.5rem; /* Restore desktop gap */
      }
      .add-task-form-details {
        flex-direction: row; /* Desktop: row */
        align-items: center;
        flex-wrap: nowrap;
        gap: 1.5rem;
      }
      .add-task-form ::ng-deep .p-inputtext,
      .add-task-form-details ::ng-deep .p-inputtext,
      .add-task-form-details ::ng-deep .p-dropdown,
      .add-task-form-details ::ng-deep .p-calendar .p-inputtext {
        width: auto !important; /* Allow width to be determined by content/flex-grow */
        flex-grow: 1; /* Allow to grow */
      }

      .add-task-form-row {
        flex-direction: row;
        align-items: center;
      }

      .add-task-form ::ng-deep .p-button-success.p-button-rounded {
        width: 50px; /* Restore desktop button size */
        height: 50px;
        min-width: 50px;
        font-size: 1.5rem;
        align-self: center; /* Center vertically on desktop */
        margin: 0; /* Remove auto margin */
      }

      .toggle-visual {
        width: auto; /* Revert to auto width on desktop */
        max-width: none; /* Remove max-width on desktop */
        margin-top: 0; /* Remove margin */
      }
      .toggle-visual ::ng-deep .p-togglebutton {
          width: auto; /* Revert to auto width on desktop */
      }

      .timeline-content {
          flex-direction: row; /* Desktop: row */
          align-items: center;
          justify-content: space-between;
          width: 100%;
          gap: 1rem;
      }
      .timeline-primary-info {
        flex-wrap: nowrap;
        flex-grow: 1;
      }
      .task-title-text {
        flex-grow: 1;
        font-size: 1.15rem; /* Restore desktop font size */
      }
      .task-time-text {
        margin-left: 1rem; /* Space from title */
        flex-shrink: 0;
        width: auto; /* Revert to auto width on desktop */
        text-align: left; /* Align to left on desktop */
      }
      .task-description {
        margin-top: 0; /* Remove margin */
      }
      .timeline-task-actions {
        margin-top: 0;
        align-self: center;
        width: auto; /* Revert to auto width on desktop */
        justify-content: flex-start; /* Reset justify content */
      }
      .task-delete-button {
          margin-left: 0; /* Remove auto-margin on desktop */
      }

      ::ng-deep .p-stepper-panel .p-stepper-header {
        padding: 1.25rem; /* Restore desktop padding */
      }
      ::ng-deep .p-stepper-panel .p-stepper-title {
          font-size: 1.2rem; /* Restore desktop font size */
          margin-right: 0.5rem; /* Restore desktop margin */
      }
      .completed-badge-stepper {
          position: static; /* Keep static for inline display */
          font-size: 0.7rem; /* Restore desktop font size */
          padding: 0.2em 0.5em; /* Restore desktop padding */
      }

      .step-panel-content {
        padding: 1.5rem; /* Restore desktop padding */
        flex-direction: row; /* Desktop: row */
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: flex-start;
      }
      .step-panel-content p {
        font-size: 0.95rem; /* Restore desktop font size */
        flex-basis: 48%; /* Roughly two columns */
      }
      .p-button-danger-block {
        flex-basis: 100%;
        text-align: right;
      }
      .edit-fields {
        display: flex;
        flex-direction: row; /* Desktop: row */
        flex-wrap: wrap;
        gap: 1rem;
      }
      .edit-fields ::ng-deep p-floatlabel {
        width: 250px;
        flex-shrink: 0;
      }
      .edit-fields ::ng-deep input[type="text"] {
        flex-grow: 1;
      }
      .edit-fields ::ng-deep p-dropdown {
        width: 180px;
        flex-shrink: 0;
      }

      .step-actions {
        flex-wrap: nowrap; /* Prevent wrapping on larger screens */
        flex-grow: 0; /* Don't force buttons to grow */
        gap: 0.75rem; /* Restore desktop gap */
      }
      ::ng-deep .step-actions button {
        padding: 0.75rem 1.25rem; /* Restore desktop padding */
        flex-grow: 0; /* Revert button growth */
      }
    }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  userLoggedIn: boolean = false;
  userName: string = '';
  userPhotoUrl: string | null = null;
  private userSubscription: Subscription | undefined;
  isLoadingAuth: boolean = true; // Começa como true para mostrar o skeleton no início

  constructor(public _config: PrimeNG, private authService: AuthService) {
    this.setLocale(this._config);
  }

  ngOnInit(): void {
    this.userSubscription = this.authService.user$.subscribe(user => {
      this.isLoadingAuth = false; // Autenticação concluída (usuário logado ou não)

      if (user) {
        this.userLoggedIn = true;
        this.userName = user.displayName || user.email || 'Usuário';
        this.userPhotoUrl = user.photoURL;
        console.log('Usuário logado:', user.uid, user.displayName);
        // Aqui você pode carregar dados específicos do usuário, se tiver
      } else {
        this.userLoggedIn = false;
        this.userName = '';
        this.userPhotoUrl = null;
        console.log('Usuário deslogado');
        // Limpar dados do usuário, se necessário
      }
      this.updateCompletionProgressBar();
    });
  }

  ngOnDestroy(): void {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  async login() {
    this.isLoadingAuth = true; // Mostra o skeleton ao iniciar o login
    try {
      await this.authService.googleSignIn();
    } catch (error) {
      console.error('Falha no login:', error);
      // feedback ao usuário
    } finally {
      this.isLoadingAuth = false; // Esconde o skeleton após a tentativa de login
    }
  }

  async logout() {
    this.isLoadingAuth = true; // Mostra o skeleton ao iniciar o logout
    try {
      await this.authService.signOutUser();
    } catch (error) {
      console.error('Falha no logout:', error);
      // feedback ao usuário
    } finally {
      this.isLoadingAuth = false; // Esconde o skeleton após o logout
    }
  }

  progressValueSubject = new BehaviorSubject<number>(0);
  progressValue$ = this.progressValueSubject.asObservable();

  updateCompletionProgressBar(): void {
    const totalTasks = this.currentTasks.length;
    const completedTasks = this.currentTasks.filter(task => task.completed).length;

    let percentage = 0;
    if (totalTasks > 0) {
      percentage = (completedTasks / totalTasks) * 100;
    }
    this.progressValueSubject.next(parseFloat(percentage.toFixed(0)));
  }

  updateActiveStepAndProgressBar(event: any): void {
    this.activeStepIndex = event.index;
    this.updateCompletionProgressBar();
  }

  setLocale(config: PrimeNG): void {
    config.setTranslation({
      startsWith: 'Começa com',
      contains: 'Contém',
      notContains: 'Não contém',
      endsWith: 'Termina com',
      equals: 'É igual a',
      notEquals: 'Não é igual a',
      noFilter: 'Sem filtro',
      lt: 'Menor que',
      lte: 'Menor ou igual a',
      gt: 'Maior que',
      gte: 'Maior ou igual a',
      is: 'É',
      isNot: 'Não é',
      before: 'Antes',
      after: 'Depois',
      apply: 'Aplicar',
      matchAll: 'Corresponder a todos',
      matchAny: 'Corresponder a qualquer um',
      addRule: 'Adicionar regra',
      removeRule: 'Remover regra',
      accept: 'Sim',
      reject: 'Não',
      choose: 'Escolher',
      upload: 'Carregar',
      cancel: 'Limpar', // Ajustado para "Limpar" para o botão de cancelar do calendário
      dayNames: ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'],
      dayNamesShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
      dayNamesMin: ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'],
      monthNames: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
      monthNamesShort: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
      today: 'Hoje',
      clear: 'Limpar',
      weekHeader: 'Sem',
      dateFormat: 'dd/mm/yy'
    });
  }

  days = ['2ª', '3ª', '4ª', '5ª', '6ª', 'Sab', 'Dom'];
  selectedDay = '2ª';
  activeStepIndex = 0;
  showTimeline = false;

  priorityOptions = [
    { label: 'Urgente', value: 'Urgente' },
    { label: 'Normal', value: 'Normal' },
    { label: 'Baixa', value: 'Baixa' }
  ];

  tasks: { [day: string]: Task[] } = {
    '2ª': [],
    '3ª': [],
    '4ª': [],
    '5ª': [],
    '6ª': [],
    'Sab': [],
    'Dom': []
  };

  currentTasks: Task[] = this.tasks['2ª'];

  newTaskTitle = '';
  newTaskDescription = '';
  newTaskDateTime: any = ''; // Será um objeto Date aqui antes de formatar
  newTaskPriority: 'Urgente' | 'Normal' | 'Baixa' | null = null;

  rangeDates: Date[] = [];
  calendar_pt = {
    firstDayOfWeek: 1,
    dayNames: ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'],
    dayNamesShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
    dayNamesMin: ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'],
    monthNames: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
    monthNamesShort: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
    today: 'Hoje',
    clear: 'Limpar',
  };

  selectDay(day: string) {
    // Antes de mudar o dia, garantir que não há tarefas em modo de edição
    this.currentTasks.forEach(task => {
      if (task.isEditing) {
        // Se uma tarefa está em edição e o dia é trocado, cancela a edição
        this.cancelEdit(task);
      }
    });

    this.selectedDay = day;
    this.activeStepIndex = 0;
    this.refreshTasks();
    this.updateCompletionProgressBar();
  }

  refreshTasks() {
    this.currentTasks = [...this.tasks[this.selectedDay]];
    // Ajusta o activeStepIndex se a tarefa ativa for removida ou a lista ficar vazia
    if (this.activeStepIndex >= this.currentTasks.length && this.currentTasks.length > 0) {
      this.activeStepIndex = this.currentTasks.length - 1;
    } else if (this.currentTasks.length === 0) {
      this.activeStepIndex = 0;
    } else if (this.activeStepIndex < 0 && this.currentTasks.length > 0) {
        this.activeStepIndex = 0; // Garante que não seja negativo
    }
    this.updateCompletionProgressBar();
  }

  addTask() {
    if (!this.newTaskTitle || !this.newTaskDateTime) {
      return; // Impede adicionar tarefa sem título ou data/hora
    }

    const taskTime = new Date(this.newTaskDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const taskDate = new Date(this.newTaskDateTime).toLocaleDateString();
    const formattedDateTime = `${taskDate} - ${taskTime}`;

    const newTask: Task = {
      title: this.newTaskTitle,
      time: formattedDateTime,
      originalDateTime: this.newTaskDateTime, // Guarda o objeto Date original
      description: this.newTaskDescription,
      priority: this.newTaskPriority ?? 'Normal',
      completed: false,
      isEditing: false // Começa como não editando
    };

    this.tasks[this.selectedDay].push(newTask);
    this.sortTasksByDateTime(); // Garante que as tarefas sejam ordenadas após a adição
    this.refreshTasks();
    this.newTaskTitle = '';
    this.newTaskDateTime = '';
    this.newTaskDescription = '';
    this.newTaskPriority = null;
    if (this.currentTasks.length === 1) {
      this.activeStepIndex = 0;
    }
    this.updateCompletionProgressBar();
  }

  removeTask(taskToRemove: Task) {
    this.tasks[this.selectedDay] = this.tasks[this.selectedDay].filter(task => task !== taskToRemove);
    this.refreshTasks();
  }

  completeTask(task: Task, activateCallback: (index: number) => void, currentIndex: number) {
    task.completed = true;
    task.isEditing = false; // Garante que saia do modo de edição ao concluir
    this.updateCompletionProgressBar();

    // Avança para o próximo passo se não for a última tarefa
    if (currentIndex < this.currentTasks.length - 1) {
      activateCallback(currentIndex + 1);
    }
  }

  editTask(task: Task) {
    // Antes de entrar no modo de edição, guarda uma cópia da tarefa original
    // para poder restaurar se o usuário cancelar
    task._originalTaskCopy = { ...task }; // Cria uma cópia rasa

    // Entra no modo de edição
    task.isEditing = true;
    // Uma tarefa em edição não deve ser mostrada como concluída
    task.completed = false;
    this.updateCompletionProgressBar();
  }

  saveTask(task: Task, activateCallback: (index: number) => void, currentIndex: number) {
    // Formata a nova data/hora se ela foi alterada
    if (task.originalDateTime) {
      const newTime = new Date(task.originalDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const newDate = new Date(task.originalDateTime).toLocaleDateString();
      task.time = `${newDate} - ${newTime}`;
    }

    // Sai do modo de edição
    task.isEditing = false;
    delete task._originalTaskCopy; // Remove a cópia temporária

    this.sortTasksByDateTime(); // Reordena após a edição, caso a data/hora tenha sido alterada
    this.refreshTasks(); // Re-renderiza para aplicar ordenação e sair do modo de edição
  }

  cancelEdit(task: Task) {
    if (task._originalTaskCopy) {
      // Restaura as propriedades da tarefa a partir da cópia original
      task.title = task._originalTaskCopy.title;
      task.time = task._originalTaskCopy.time;
      task.originalDateTime = task._originalTaskCopy.originalDateTime;
      task.description = task._originalTaskCopy.description;
      task.priority = task._originalTaskCopy.priority;
      task.completed = task._originalTaskCopy.completed; // RESTAURA O ESTADO COMPLETED ORIGINAL
    }
    task.isEditing = false;
    delete task._originalTaskCopy; // Remove a cópia temporária
    this.refreshTasks(); // Para garantir que o display volte ao normal e os estilos de "concluído" reapareçam
  }

  getPriorityCountForDay(day: string, priorityType: 'Urgente' | 'Normal' | 'Baixa'): number {
    return this.tasks[day].filter(task => task.priority === priorityType).length;
  }

  // Lógica para Drag and Drop na Timeline e Stepper
  drop(event: CdkDragDrop<Task[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(this.currentTasks, event.previousIndex, event.currentIndex);
      this.tasks[this.selectedDay] = [...this.currentTasks];
      this.refreshTasks();
      this.updateCompletionProgressBar();
    }
  }

  // Lógica para mover tarefas no Stepper E Timeline (setas)
  moveTask(index: number, direction: -1 | 1) {
    if (index + direction >= 0 && index + direction < this.currentTasks.length) {
      const taskToMove = this.currentTasks[index];
      const targetIndex = index + direction;

      const newTasks = [...this.currentTasks];
      newTasks.splice(index, 1);
      newTasks.splice(targetIndex, 0, taskToMove);

      this.tasks[this.selectedDay] = newTasks;
      this.refreshTasks();

      this.activeStepIndex = targetIndex;
    }
  }

  // Função auxiliar para ordenar as tarefas por data e hora (usada após adicionar e salvar)
  sortTasksByDateTime() {
    this.tasks[this.selectedDay].sort((a, b) => {
      const dateA = a.originalDateTime ? a.originalDateTime.getTime() : new Date(a.time.split(' - ')[0]).getTime() + (parseInt(a.time.split(' - ')[1].split(':')[0]) * 3600000) + (parseInt(a.time.split(' - ')[1].split(':')[1]) * 60000);
      const dateB = b.originalDateTime ? b.originalDateTime.getTime() : new Date(b.time.split(' - ')[0]).getTime() + (parseInt(b.time.split(' - ')[1].split(':')[0]) * 3600000) + (parseInt(b.time.split(' - ')[1].split(':')[1]) * 60000);
      return dateA - dateB;
    });
  }
}
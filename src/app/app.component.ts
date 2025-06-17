import { Component, OnInit, OnDestroy, inject, AfterViewChecked, AfterViewInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Auth, GoogleAuthProvider, signInWithPopup, signOut, user } from '@angular/fire/auth';
import { Firestore, collection, addDoc, query, where, getDocs, doc, updateDoc, deleteDoc, writeBatch, getDoc, setDoc } from '@angular/fire/firestore';
import { Observable, Subscription, BehaviorSubject } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ConfirmationService, MenuItem, SelectItem, MenuItemCommandEvent } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextarea } from 'primeng/inputtextarea';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { ProgressBarModule } from 'primeng/progressbar';
import { TimelineModule } from 'primeng/timeline';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SpeedDialModule } from 'primeng/speeddial';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { DialogModule } from 'primeng/dialog';
import { FloatLabelModule } from 'primeng/floatlabel';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { BadgeModule } from 'primeng/badge';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import * as CryptoJS from 'crypto-js'; // Importa a biblioteca para SHA1
import { DividerModule } from 'primeng/divider';

// Importações para Angular Animations
import { trigger, state, style, animate, transition } from '@angular/animations';

// Definições de Interfaces
interface Task {
  id?: string;
  title: string;
  description: string;
  dateTime: Date;
  time: string;
  priority: 'Urgente' | 'Normal' | 'Baixa';
  completed: boolean;
  userId: string;
  originalDateTime?: Date; // Opcional para edição
  orderIndex: number;
  category: string | null; // Alterado para permitir null
  isEditing?: boolean; // Adicionada a propriedade isEditing para o estado da UI
  audioUrl?: string; // NOVO: URL para o ficheiro de áudio, se existir
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

interface WeekDay {
  nameShort: string; // Ex: "Seg", "Ter"
  dateNumber: number; // Ex: 5, 6
  fullDate: Date; // A data completa para filtro
  hasTasks: boolean; // Indica se há tarefas para este dia
  isToday: boolean; // Indica se é o dia de hoje
}


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ConfirmDialogModule,
    ToastModule,
    ButtonModule,
    CardModule,
    InputTextModule,
    InputTextarea,
    CalendarModule,
    DropdownModule,
    ProgressBarModule,
    TimelineModule,
    DragDropModule,
    ProgressSpinnerModule,
    SpeedDialModule,
    AutoCompleteModule,
    DialogModule,
    FloatLabelModule,
    TooltipModule,
    TagModule,
    BadgeModule,
    HttpClientModule,
    DividerModule // Adicionar HttpClientModule aqui
  ],
  providers: [MessageService, ConfirmationService, DatePipe],
  // Definição das animações no componente
  animations: [
    trigger('fadeInOut', [
      state('void', style({
        opacity: 0,
        transform: 'translateY(20px)'
      })),
      transition('void => *', [
        animate('0.5s ease-out', style({
          opacity: 1,
          transform: 'translateY(0)'
        }))
      ]),
      transition('* => void', [
        animate('0.5s ease-out', style({
          opacity: 0,
          transform: 'translateY(-20px)'
        }))
      ])
    ])
  ],
  template: `
    <p-confirmDialog></p-confirmDialog>
    <p-toast></p-toast>

    <!-- Diálogo para Notificação de Novo Deploy -->
    <p-dialog header="Nova Versão Disponível!" [(visible)]="displayDeployDialog" [modal]="true" [style]="{width: '40vw'}" [breakpoints]="{'960px': '75vw', '640px': '90vw'}" appendTo="body">
      <div class="p-fluid">
        <p>Olá! Uma nova versão do Gestor de Tarefas (v{{deployVersion}}) foi implementada. Desfrute das novidades!</p>
        <p>Aproveite para categorizar melhor as suas tarefas.</p>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Percebi!" icon="pi pi-check" styleClass="p-button-success" (click)="closeDeployDialog()"></p-button>
      </ng-template>
    </p-dialog>

    <!-- O p-dialog foi movido para o nível superior do template, deve permanecer aqui para funcionar corretamente -->
    <p-dialog header="Categorizar Tarefa" [(visible)]="displayCategoryDialog" [modal]="true" [style]="{width: '50vw'}" [breakpoints]="{'960px': '75vw', '640px': '90vw'}" appendTo="body">
      <div class="p-fluid">
        <p>O item "<strong>{{newlyAddedTaskValue}}</strong>" não existe nas suas categorias. Por favor, categorize-o:</p>
        <div class="p-field">
          <label for="categoryDropdown">Categoria</label>
          <p-dropdown id="categoryDropdown" [(ngModel)]="selectedCategoryForNewTask" [options]="availableCategories" optionLabel="label" placeholder="Selecione uma categoria" appendTo="body"></p-dropdown>
        </div>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" icon="pi pi-times" styleClass="p-button-secondary" (click)="cancelCategorization()"></p-button>
        <p-button label="Categorizar" icon="pi pi-check" styleClass="p-button-success p-ml-2" (click)="categorizeTaskTitle()"></p-button>
      </ng-template>
    </p-dialog>

    <div class="main-container">
      <div class="topbar">
        <div class="user-info" *ngIf="userLoggedIn; else loginSection">
          <img [src]="userPhotoUrl || 'assets/default-avatar.png'" alt="User Avatar" class="user-avatar" />
          <span class="user-name">{{ userName }}</span>
          <button pButton icon="pi pi-sign-out" label="Sair" (click)="logout()" class="p-button-danger p-button-sm"></button>
        </div>
        <!-- Reorganizado para uma estrutura mais lógica no cabeçalho -->
        <div class="topbar-content">
          <div class="branding">
            <i class="pi pi-check-square brand-icon"></i>
            <span>Gestor de Tarefas</span>
          </div>

          <!-- Botões de navegação e adição de tarefa -->
          <div class="task-mode-buttons">
            <p-button label="Nova Tarefa" icon="pi pi-plus" class="addTaskButton" (click)="setViewMode('addTask')" severity="contrast"></p-button>
            <div class="week-range-dropdown-container">
              <p-dropdown
                class="week-range-dropdown"
                [(ngModel)]="selectedWeekRange"
                [options]="availableWeekRanges"
                optionLabel="label"
                optionValue="value"
                placeholder="Selecione Semana"
                (onChange)="onWeekRangeSelect($event)"
                styleClass="w-full"
                appendTo="body"
            ></p-dropdown>
        </div>
                    <!-- NOVO: Botão de Microfone para Gravação de Áudio -->
            <button pButton icon="pi pi-microphone" label="Gravar Áudio"
                    [class.recording-active]="isRecording"
                    [class.holding-microphone]="isHoldingMicrophone && !isRecording"
                    (mousedown)="onMicrophonePress()"
                    (mouseup)="onMicrophoneRelease()"
                    (touchstart)="onMicrophonePress()"
                    (touchend)="onMicrophoneRelease()"
                    class="p-button-secondary microphone-button"
                    pTooltip="Pressione e segure por 3 segundos para gravar áudio"
                    tooltipPosition="bottom"
            ></button>
            <!-- FIM NOVO BOTÃO MICROFONE -->
            <!-- NOVA LINHA TEMPORAL NO LUGAR DOS BOTÕES DE DIAS -->
            <div class="week-timeline">
              <div *ngFor="let day of weekDays" 
                   class="day-item"
                   [class.selected-day]="isSameDay(day.fullDate, selectedDate)"
                   [class.today-highlight]="day.isToday && !isSameDay(day.fullDate, selectedDate)"
                   (click)="selectDayByDate(day.fullDate)">
                <span class="day-name">{{ day.nameShort }}</span>
                <span class="day-number">{{ day.dateNumber }}</span>
                <p-badge *ngIf="day.hasTasks" severity="danger" value="" class="tasks-badge"></p-badge>
              </div>
            </div>
            <!-- FIM DA NOVA LINHA TEMPORAL -->
          </div>
          <ng-template #loginSection>
            <div class="login-prompt">
              <button pButton icon="pi pi-google" label="Login com Google" (click)="login()" class="p-button-success"></button>
            </div>
          </ng-template>
        </div>
        <!-- Botões para gerenciar categorias no cabeçalho -->
        <div class="topbar-content category-management-buttons">
            <!-- Toggle Button for Delete Options -->
            <p-button
                iconPos="right"
                [icon]="showDeleteOptions ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
                [label]="showDeleteOptions ? 'Esconder Opções de Gestão' : 'Mostrar Opções de Gestão'"
                (click)="toggleDeleteOptions()"
                styleClass="p-button-secondary p-button-sm toggle-management-options-button"
                severity="contrast"
            ></p-button>

            <div *ngIf="showDeleteOptions" class="management-options-container p-d-flex p-flex-column p-gap-3" @fadeInOut>
                <!-- The three delete buttons from the user's latest snippet -->
                <p-button
                    label="Eliminar Todas as Tarefas de {{ formattedNewTaskDateDisplay }}"
                    icon="pi pi-eraser"
                    styleClass="p-button-danger p-mr-2"
                    (click)="confirmDeleteAllTasksToday()"
                    [raised]="true"
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
                <p-button 
                    label="Eliminar TODAS as Categorias" 
                    icon="pi pi-user-minus"
                    styleClass="p-button-warn p-button-sm" 
                    (click)="confirmDeleteAllCategories()"
                    [raised]="true"
                    [disabled]="areOnlyDefaultCategoriesPresent"
                    pTooltip="Isto eliminará apenas as categorias criadas por si, as categorias padrão não serão afetadas.">
                </p-button>
            </div>
        </div>
      </div>

      <div [ngClass]="{'content-wrapper': true, 'content-wrapper-action-category-btn-visible': showDeleteOptions}" *ngIf="userLoggedIn && !isLoadingAuth">
        <p-progressSpinner *ngIf="isLoadingTasks" styleClass="w-4rem h-4rem" strokeWidth="8" animationDuration=".5s"></p-progressSpinner>

        <div class="app-layout" *ngIf="!isLoadingTasks" [ngClass]="{'single-column-layout': viewMode === 'addTask' || viewMode === 'expandedTask'}">
          <!-- Condicionalmente exibe o formulário de nova tarefa -->
          <div class="task-form-column p-fluid" *ngIf="viewMode === 'addTask'" @fadeInOut>
            <p-card header="Adicionar Nova Tarefa" class="mb-4">
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
                <button pButton type="button" icon="pi pi-plus" (click)="addTask()" [disabled]="!newTaskTitle || !newTaskDateTime"></button>
              </div>

            </p-card>
          </div>

          <!-- Condicionalmente exibe a linha do tempo das tarefas -->
          <div class="task-timeline-column" *ngIf="viewMode === 'timeline'">
            <p-card [header]="'Tarefas para ' + (formattedNewTaskDateDisplay)" class="mb-4">
              <div class="p-d-flex p-ai-center p-jc-between p-mb-4 progress-section-header"> <div class="p-text-lg p-text-bold">Progresso do Dia:</div>
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
                      <p-divider align="left" type="solid">
                        <p-tag *ngIf="task.category && task.completed" severity="secondary" [rounded]="true" [value]="task.category" [ngStyle]="{'margin-bottom': '10px', 'opacity': 'unset'}"></p-tag>
                        <p-tag *ngIf="task.category && !task.completed && task.priority === 'Urgente'" severity="danger" [rounded]="true" [value]="task.category" [ngStyle]="{'margin-bottom': '10px'}"></p-tag>
                        <p-tag *ngIf="task.category && !task.completed && task.priority === 'Normal'" severity="warning" [rounded]="true" [value]="task.category" [ngStyle]="{'margin-bottom': '10px'}"></p-tag>
                        <p-tag *ngIf="task.category && !task.completed && task.priority === 'Baixa'" severity="info" [rounded]="true" [value]="task.category" [ngStyle]="{'margin-bottom': '10px'}"></p-tag>
                      </p-divider>
                        <div class="task-item-wrapper" [class.task-completed]="task.completed" cdkDrag>
                            <div class="cdk-drag-handle" cdkDragHandle>
                              <i class="pi pi-bars"></i>
                            </div>

                            <div class="p-d-flex p-jc-between p-ai-start" [ngStyle]="{'padding-top': i === 0 ? '0px' : '5px'}">
                                <div class="p-flex-grow-1" [ngClass]="{'task-block': true, 'task-concluded-block': task.completed, 'task-in-progress-block': !task.completed, 'task-is-being-edited': task.isEditing}" [ngStyle]="{'padding-bottom': '20px'}">
                                  <!-- Lógica de exibição de tags de categoria baseada em prioridade e status de conclusão -->
                                  <!-- <p-tag *ngIf="task.category && task.completed" severity="secondary" [rounded]="true" [value]="task.category" [ngStyle]="{'margin-bottom': '10px', 'opacity': 'unset'}"></p-tag>
                                  <p-tag *ngIf="task.category && !task.completed && task.priority === 'Urgente'" severity="danger" [rounded]="true" [value]="task.category" [ngStyle]="{'margin-bottom': '10px'}"></p-tag>
                                  <p-tag *ngIf="task.category && !task.completed && task.priority === 'Normal'" severity="warning" [rounded]="true" [value]="task.category" [ngStyle]="{'margin-bottom': '10px'}"></p-tag>
                                  <p-tag *ngIf="task.category && !task.completed && task.priority === 'Baixa'" severity="info" [rounded]="true" [value]="task.category" [ngStyle]="{'margin-bottom': '10px'}"></p-tag> -->
<div *ngIf="task.audioUrl" class="audio-player-container">
    <audio [id]="'audio-' + task.id" preload="auto"></audio>
    <div class="controls">
        <!-- CERTIFIQUE-SE QUE TEM O <i> DENTRO DO <button> -->
        <button [id]="'play-button-' + task.id" pButton icon="pi pi-play" class="p-button-rounded p-button-text p-button-sm">
            <i class="pi pi-play"></i> <!-- ESTA LINHA É FUNDAMENTAL -->
        </button>
        <div [id]="'progress-bar-' + task.id" class="progress-bar">
            <div class="progress-fill"></div>
            <div class="progress-handle"></div>
        </div>
    </div>
</div>
                                  <div style="display: flex;">
                                    <h4 class="task-title" [class.line-through]="task.completed" [ngClass]="{'task-concluded-label': task.completed}" [ngStyle]="{'margin-top': '0px', 'margin-bottom': '10px'}">{{ task.title }}</h4>
                                  </div>
                                  <p *ngIf="task.description" class="p-mt-2 task-description" [ngClass]="{'task-concluded-label': task.completed}" style="margin-top: 0px; margin-bottom: 10px"> {{ task.description }}</p>
                                  <div [ngStyle]="{'display': 'flex', 'justify-content': 'space-between'}">
                                    <p class="p-m-0 p-text-sm p-text-secondary" [ngClass]="{'task-concluded-label': task.completed}">{{ task.time }} - {{ task.dateTime.toLocaleDateString() }}</p>
                                    <i class="pi pi-search-plus" (click)="viewTask(task)" [ngStyle]="{'margin-right': '7px'}"></i>
                                  </div>
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

                            <div *ngIf="task.isEditing" [ngClass]="{'p-fluid': true, 'task-edit-block': true, 'task-edit-concluded': task.completed}">
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
                    </ng-template>
                  </p-timeline>
                </div>
              </div>
              <ng-template #noTasks>
                <p class="no-tasks">Nenhuma tarefa para {{ selectedDate | date:'fullDate':'pt-PT' }} ainda.</p>
              </ng-template>
            </p-card>
          </div>

          <!-- NOVO: Vista de Tarefa Expandida -->
          <div class="task-expanded-column" *ngIf="viewMode === 'expandedTask' && selectedTask" @fadeInOut>
            <p-card>
              <ng-template #title>
                <div  [ngStyle]="{'display': 'flex', 'justify-content': 'space-between'}">
                  {{ selectedTask.title }}
                  <i class="pi pi-search-minus" (click)="backToTimeline()"></i>
                </div>
              </ng-template>
              <div class="p-fluid">
                <div class="p-field">
                  <label>Descrição:</label>
                  <p>{{ selectedTask.description || 'Nenhuma descrição.' }}</p>
                </div>
                <div class="p-field">
                  <label>Data e Hora:</label>
                  <p>{{ selectedTask.dateTime | date:'fullDate':'pt-PT' }} às {{ selectedTask.time }}</p>
                </div>
                <div class="p-field">
                  <label>Prioridade:</label>
                  <p>{{ selectedTask.priority }}</p>
                </div>
                <div class="p-field" *ngIf="selectedTask.category">
                  <label>Categoria:</label>
                  <p>{{ selectedTask.category }}</p>
                </div>
                <div class="p-field">
                  <label>Status:</label>
                  <p>{{ selectedTask.completed ? 'Concluída' : 'Pendente' }}</p>
                </div>
              </div>
              <ng-template pTemplate="footer">
                <p-button label="Voltar à Lista" icon="pi pi-arrow-left" styleClass="p-button-secondary" (click)="backToTimeline()"></p-button>
              </ng-template>
            </p-card>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy, AfterViewChecked, AfterViewInit {

  // Injeções de Dependência
  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);
  private messageService: MessageService = inject(MessageService);
  private confirmationService: ConfirmationService = inject(ConfirmationService);
  private datePipe: DatePipe = inject(DatePipe);
  private http: HttpClient = inject(HttpClient); // Injetar HttpClient

  // Propriedades de Autenticação e Utilizador
  userLoggedIn: boolean = false;
  userName: string = 'Convidado';
  userPhotoUrl: string | null = null;
  userId: string | null = null;
  private userSubscription: Subscription | null = null;
  isLoadingAuth: boolean = true;

  // Propriedades de Gestão de Tarefas
  selectedDay: string = 'Hoje';
  selectedDate: Date = new Date(); // Para a data selecionada na linha do tempo
  weekDays: WeekDay[] = []; // Array para a linha temporal da semana
  currentTasks: Task[] = [];
  allTasks: Task[] = [];
  isLoadingTasks: boolean = false;

  // Variável para controlar qual secção de conteúdo está visível
  viewMode: 'addTask' | 'timeline' | 'expandedTask' = 'timeline';
  selectedTask: Task | null = null; // Para armazenar a tarefa selecionada para visualização expandida

  // Propriedade para controlar a visibilidade dos botões de gestão
  showDeleteOptions: boolean = false;

  selectedWeekRange: Date | null = null;
  availableWeekRanges: SelectItem[] = []; // Used for p-dropdown options

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
    { label: '-- VILA REAL --', value: 'vila-real', items: [] },
    { label: '-- PORTO --', value: 'porto', items: [] },
    { label: '-- CASA --', value: 'casa', items: [] },
    { label: '-- TRABALHO --', value: 'trabalho', items: [] },
    { label: '-- COMPROMISSOS --', value: 'compromissos', items: [] }
  ];
  groupedTasks: TaskGroup[] = [];
  filteredGroupedTasks: TaskGroup[] = [];

  // Propriedades para o Diálogo de Categorização de Nova Tarefa
  displayCategoryDialog: boolean = false;
  newlyAddedTaskValue: string = '';
  selectedCategoryForNewTask: SelectItem | null = null;
  availableCategories: SelectItem[] = [];

  // Propriedade para minDate do p-calendar
  todayMinDate: Date = new Date();

  // Propriedade para o Calendário (localização PT)
  calendar_pt = {
    firstDayOfWeek: 0,
    dayNames: ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"],
    dayNamesShort: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
    monthNames: ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"],
    monthNamesShort: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
    today: 'Hoje',
    clear: 'Limpar',
    dateFormat: 'dd/mm/yy',
    weekHeader: 'Sem'
  };

  // Propriedades para a Barra de Progresso
  private progressSubject = new BehaviorSubject<number>(0);
  progressValue$: Observable<number> = this.progressSubject.asObservable();

  // Flag para controlar se a transição diária de tarefas já foi feita na sessão atual
  private dailyTransitionDone: boolean = false;
  // Flag para controlar o fluxo de seleção/blur do autocomplete
  private isSelectionOccurring: boolean = false;

  // Propriedade para controlar a tarefa sendo editada (se houver)
  currentEditingTask: Task | null = null;

  // NOVAS PROPRIEDADES PARA ELIMINAÇÃO DE CATEGORIAS
  selectedCategoryToDelete: SelectItem | null = null;
  availableCategoriesForDeletion: SelectItem[] = [];

  // NOVAS PROPRIEDADES PARA O DIÁLOGO DE DEPLOY
  currentAppVersion: string = '1.0.1'; // Definir a versão atual da aplicação
  displayDeployDialog: boolean = false;
  deployVersion: string = '';

  // Propriedades para Gravação de Áudio e Controlo do Microfone
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private recordingTimeout: any;
  isRecording: boolean = false;
  isHoldingMicrophone: boolean = false;
  private audioStream: MediaStream | null = null;

  // Propriedades para Gestão do Leitor de Áudio no UI
  private audioPlayerInstances = new Map<string, { audio: HTMLAudioElement; progressBar: HTMLDivElement; playButton: HTMLButtonElement; }>();

  // Credenciais do Cloudinary (Substitua com os seus valores reais)
  private CLOUDINARY_CLOUD_NAME = 'dghcjlx6b'; // <--- SUBSTITUA ISTO
  private CLOUDINARY_UPLOAD_PRESET = 'task_audio_upload'; // <--- SUBSTITUA ISTO
  // !!! AVISO DE SEGURANÇA CRÍTICO !!!
  // Estes são os seus Cloudinary API Key e API Secret.
  // NUNCA DEVE EXPOR O SEU CLOUDINARY_API_SECRET EM CÓDIGO FRONTEND EM PRODUÇÃO.
  // ESTA IMPLEMENTAÇÃO É APENAS PARA DEMONSTRAÇÃO E TESTES EM AMBIENTES CONTROLADOS.
  // PARA ELIMINAÇÃO SEGURA, USE UM BACKEND (ex: Firebase Cloud Function).
  private CLOUDINARY_API_KEY = '763626697511548'; // <--- SUBSTITUA ISTO PELO SEU API Key REAL
  private CLOUDINARY_API_SECRET = 'lmIu2GWp9xcBZQoPvBQGhqXLT1c'; // <--- SUBSTITUA ISTO PELO SEU API Secret REAL (!!!! NUNCA EXPOR PUBLICAMENTE !!!!)
  // FIM AVISO DE SEGURANÇA CRÍTICO

    stepsCount: number = 0;
  isPedometerActive: boolean = false;
  private lastMotionTime: number = 0;
  private lastAccelerationMagnitude: number = 0;
  private stepThreshold: number = 1.5; // Ajuste este valor conforme a sensibilidade desejada
  private debounceTime: number = 300; // Tempo em ms para evitar contagem dupla de passos
  pedometerWarning: string | null = null;


  constructor() { }

    async ngOnInit(): Promise<void> {
    this.userSubscription = user(this.auth).subscribe(async firebaseUser => {
      if (firebaseUser) {
        this.userLoggedIn = true;
        this.userName = firebaseUser.displayName || firebaseUser.email || 'Utilizador';
        this.userPhotoUrl = firebaseUser.photoURL;
        this.userId = firebaseUser.uid;
        this.isLoadingAuth = false;

        this.generateWeekRanges();
        this.selectCurrentWeek();

        await this.loadUserCategories();
        await this.fetchTasks();
        if (!this.dailyTransitionDone) {
          await this.transitionOverdueTasks();
          this.dailyTransitionDone = true;
        }
        await this.checkAppVersion();
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
        this.generateWeekDays();
        this.generateWeekRanges();
        this.selectCurrentWeek();
      }
    });

    // Verificar suporte a DeviceMotionEvent ao iniciar o componente
    if (!('DeviceMotionEvent' in window)) {
      this.pedometerWarning = 'O seu dispositivo/navegador não suporta a medição de movimento para pedómetro.';
    } else {
      // Pedir permissão para DeviceMotion (necessário em iOS 13+ por exemplo)
      if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
        try {
          const permissionState = await (DeviceMotionEvent as any).requestPermission();
          if (permissionState !== 'granted') {
            this.pedometerWarning = 'Permissão para aceder ao sensor de movimento negada. O pedómetro não funcionará.';
          }
        } catch (error) {
          console.error('Erro ao pedir permissão para DeviceMotionEvent:', error);
          this.pedometerWarning = 'Erro ao pedir permissão para aceder ao sensor de movimento. O pedómetro não funcionará.';
        }
      }
    }
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
      // Ensure task.dateTime is a valid Date object before proceeding
      if (task.id && !task.completed && task.dateTime instanceof Date && !isNaN(task.dateTime.getTime())) {
        const taskDate = new Date(task.dateTime);
        taskDate.setHours(0, 0, 0, 0);

        if (taskDate.getTime() < today.getTime()) {

          // Create newDateTime ensuring all components are numbers
          const newDateTime = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
            task.dateTime.getHours(),
            task.dateTime.getMinutes(),
            task.dateTime.getSeconds() || 0, // Fallback for seconds
            task.dateTime.getMilliseconds() || 0 // Fallback for milliseconds
          );

          if (isNaN(newDateTime.getTime())) {
            console.error('Failed to create a valid newDateTime for task:', task.id, newDateTime);
            continue; // Skip this task if new date is invalid
          }

          const taskRef = doc(this.firestore, 'tasks', task.id);
          batch.update(taskRef, {
            dateTime: newDateTime,
            time: newDateTime.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
          });
          tasksUpdatedCount++;

          task.dateTime = newDateTime;
          task.time = newDateTime.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
        }
      } else {
        // Log tasks that have invalid or missing dateTime
        console.warn('Skipping task due to invalid dateTime in transitionOverdueTasks:', task.id, task.dateTime);
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

        // Simplesmente chama fetchTasks para re-sincronizar tudo.
        this.fetchTasks(); // ALTERADO
      } catch (error: any) {
        this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao transitar tarefas: ${error.message}` });
        console.error("Erro ao transitar tarefas:", error);
      }
    }
  }

  ngOnDestroy(): void {
    this.userSubscription?.unsubscribe();
    this.progressSubject.complete();
    this.stopAudioStream();
    this.stopPedometer(); // Parar o pedómetro ao destruir o componente
  }

  ngAfterViewChecked(): void {
    // VER ALTERNATIVA!
    // this.currentTasks.forEach(task => {
    //   if (task.audioUrl && task.id && !this.audioPlayerInstances.has(task.id)) {
    //     setTimeout(() => {
    //       this.initializeAudioPlayer(task.audioUrl!, task.id!);
    //     }, 100);
    //   }
    // });
  }

    ngAfterViewInit(): void {
    // Moved from ngOnInit to ensure view is initialized
    this.searchGrouped({ query: '' });
  }

  // Métodos de Autenticação
  async login(): Promise<void> {
    try {
      this.isLoadingAuth = true;
      const provider = new GoogleAuthProvider();
      await signInWithPopup(this.auth, provider);
      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Login efetuado!' });
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha no login: ${error.message}` });
      console.error("Erro no login:", error);
    } finally {
      this.isLoadingAuth = false;
    }
  }

  async logout(): Promise<void> {
    try {
      this.isLoadingAuth = true;
      await signOut(this.auth);
      this.messageService.add({ severity: 'info', summary: 'Sessão', detail: 'Sessão terminada.' });
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha no logout: ${error.message}` });
      console.error("Erro no logout:", error);
    } finally {
      this.isLoadingAuth = false;
    }
  }

  // Métodos de Gestão de UI/Datas
  async checkAppVersion(): Promise<void> {
    if (!this.userId) return;

    try {
      const userSettingsRef = doc(this.firestore, `artifacts/__app_id/users/${this.userId}/userSettings/userSettings`);
      const docSnap = await getDoc(userSettingsRef);
      let lastSeenVersion = '0.0.0';

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && data['lastSeenAppVersion']) {
          lastSeenVersion = data['lastSeenAppVersion'];
        }
      }

      const isNewVersion = this.compareVersions(this.currentAppVersion, lastSeenVersion);

      if (isNewVersion) {
        this.deployVersion = this.currentAppVersion;
        this.displayDeployDialog = true;
      }

      await setDoc(userSettingsRef, { lastSeenAppVersion: this.currentAppVersion }, { merge: true });

    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao verificar versão: ${error.message}` });
    }
  }

  private compareVersions(v1: string, v2: string): boolean {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;

      if (p1 > p2) return true;
      if (p1 < p2) return false;
    }
    return false;
  }

  closeDeployDialog(): void {
    this.displayDeployDialog = false;
  }

  setViewMode(mode: 'addTask' | 'timeline' | 'expandedTask'): void {
    this.viewMode = mode;
    if (mode === 'addTask') {
      this.resetNewTaskForm();
    } else if (mode === 'timeline') {
      if (this.selectedWeekRange && this.selectedWeekRange instanceof Date && !isNaN(this.selectedWeekRange.getTime())) {
        this.selectWeek(this.selectedWeekRange);
      } else {
        this.selectWeek(this.getStartOfWeek(new Date()));
      }
      this.selectedTask = null;
    }
  }

  viewTask(task: Task): void {
    this.selectedTask = task;
    this.viewMode = 'expandedTask';
  }

  backToTimeline(): void {
    this.selectedTask = null;
    this.viewMode = 'timeline';
    if (this.selectedWeekRange && this.selectedWeekRange instanceof Date && !isNaN(this.selectedWeekRange.getTime())) {
      this.selectWeek(this.selectedWeekRange);
    } else {
      this.selectWeek(this.getStartOfWeek(new Date()));
    }
  }

  toggleDeleteOptions(): void {
    this.showDeleteOptions = !this.showDeleteOptions;
  }

  generateWeekDays(startDate: Date = new Date()): void {
    this.weekDays = [];
    const validStartDate = (startDate instanceof Date && !isNaN(startDate.getTime())) ? startDate : new Date();
    const start = this.getStartOfWeek(validStartDate);

    const dayNamesShort = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const dayOfWeek = date.getDay();

      this.weekDays.push({
        nameShort: dayNamesShort[dayOfWeek],
        dateNumber: date.getDate(),
        fullDate: date,
        hasTasks: this.checkTasksForDate(date),
        isToday: this.isSameDay(date, new Date())
      });
    }
  }

  generateWeekRanges(): void {
    this.availableWeekRanges = [];
    const today = new Date();

    for (let i = 0; i <= 4; i++) {
      const iterationDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + (i * 7));

      if (isNaN(iterationDate.getTime())) {
          console.warn('Skipping invalid iterationDate in generateWeekRanges:', iterationDate);
          continue;
      }

      const startOfCurrentIterationWeek = this.getStartOfWeek(iterationDate);
      const endOfCurrentIterationWeek = new Date(startOfCurrentIterationWeek);
      endOfCurrentIterationWeek.setDate(endOfCurrentIterationWeek.getDate() + 6);

      if (isNaN(startOfCurrentIterationWeek.getTime()) || isNaN(endOfCurrentIterationWeek.getTime())) {
          console.warn('Skipping invalid week range due to invalid start/end date:', startOfCurrentIterationWeek, endOfCurrentIterationWeek);
          continue;
      }

      const label = `${this.datePipe.transform(startOfCurrentIterationWeek, 'dd/MM/yyyy')} - ${this.datePipe.transform(endOfCurrentIterationWeek, 'dd/MM/yyyy')}`;
      this.availableWeekRanges.push({ label: label, value: startOfCurrentIterationWeek });
    }
  }

  selectCurrentWeek(): void {
    const today = new Date();
    const startOfTodayWeek = this.getStartOfWeek(today);

    const currentWeekOption = this.availableWeekRanges.find(
      range => this.isSameDay(range.value as Date, startOfTodayWeek)
    );

    if (currentWeekOption) {
      this.selectedWeekRange = currentWeekOption.value as Date;
      this.selectWeek(currentWeekOption.value as Date);
    } else {
      this.selectedWeekRange = startOfTodayWeek;
      this.selectWeek(startOfTodayWeek);
    }
  }

  getStartOfWeek(date: Date): Date {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
        console.error('getStartOfWeek: A data de entrada resultou num objeto Date Inválido. Entrada:', date);
        return new Date();
    }
    const dayOfWeek = d.getDay(); // 0 (Domingo) a 6 (Sábado)
    const dayDifference = (dayOfWeek === 0) ? 6 : dayOfWeek - 1; // Para Segunda-feira
    
    d.setDate(d.getDate() - dayDifference);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  onWeekRangeSelect(event: { originalEvent: Event, value: Date }): void {
    this.selectWeek(event.value);
  }

  selectWeek(startDate: Date): void {
    if (!startDate || !(startDate instanceof Date) || isNaN(startDate.getTime())) {
      console.error('selectWeek: startDate é inválida.', startDate);
      startDate = new Date(); // Fallback para data atual
    }
    
    if (this.isSameDay(startDate, this.getStartOfWeek(new Date()))) {
      this.selectedDate = new Date();
    } else {
      this.selectedDate = startDate;
    }

    this.generateWeekDays(startDate);
    this.filterTasksBySelectedDay(this.selectedDate);
    this.setNewTaskDateTimeBasedOnSelectedDay();
    this.viewMode = 'timeline';
  }

  selectDayByDate(date: Date): void {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      console.error('selectDayByDate: date é inválida.', date);
      date = new Date(); // Fallback para data atual
    }

    this.selectedDate = date;

    const startOfWeekForClickedDate = this.getStartOfWeek(date);

    if (this.selectedWeekRange && this.selectedWeekRange instanceof Date && !isNaN(this.selectedWeekRange.getTime())) {
      const currentSelectedWeekStart = this.selectedWeekRange;
      const currentSelectedWeekEnd = new Date(currentSelectedWeekStart);
      currentSelectedWeekEnd.setDate(currentSelectedWeekEnd.getDate() + 6);
      currentSelectedWeekEnd.setHours(23, 59, 59, 999);

      if (date.getTime() >= currentSelectedWeekStart.getTime() && date.getTime() <= currentSelectedWeekEnd.getTime()) {
        // No change to selectedWeekRange if within current week
      } else {
        this.updateSelectedWeekRangeFromTimeline(date);
      }
    } else {
      this.updateSelectedWeekRangeFromTimeline(date);
    }

    this.filterTasksBySelectedDay(date);
    this.setNewTaskDateTimeBasedOnSelectedDay();
    this.viewMode = 'timeline';
  }

  private updateSelectedWeekRangeFromTimeline(date: Date): void {
    const startOfWeekForDate = this.getStartOfWeek(date);
    
    const correspondingOption = this.availableWeekRanges.find(
      range => this.isSameDay(range.value as Date, startOfWeekForDate)
    );

    if (correspondingOption) {
      this.selectedWeekRange = correspondingOption.value as Date;
    } else {
      this.selectedWeekRange = startOfWeekForDate;
    }
  }

  filterTasksBySelectedDay(date: Date): void {
    const selectedDayStart = new Date(date);
    selectedDayStart.setHours(0, 0, 0, 0);
    const selectedDayEnd = new Date(date);
    selectedDayEnd.setHours(23, 59, 59, 999);

    this.currentTasks = this.allTasks.filter(task => {
      if (!task.dateTime) return false;
      const taskDateTime = new Date(task.dateTime);
      return taskDateTime.getTime() >= selectedDayStart.getTime() && taskDateTime.getTime() <= selectedDayEnd.getTime();
    }).sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      const dateComparison = a.dateTime.getTime() - b.dateTime.getTime();
      if (dateComparison !== 0) return dateComparison;
      return a.orderIndex - b.orderIndex;
    });
    this.updateProgressBar();
  }

  filterTasksBySelectedWeek(startDate: Date): void {
    const weekStart = new Date(startDate);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(startDate);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    this.currentTasks = this.allTasks.filter(task => {
      if (!task.dateTime) return false;
      const taskDateTime = new Date(task.dateTime);
      return taskDateTime.getTime() >= weekStart.getTime() && taskDateTime.getTime() <= weekEnd.getTime();
    }).sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      const dateComparison = a.dateTime.getTime() - b.dateTime.getTime();
      if (dateComparison !== 0) return dateComparison;
      return a.orderIndex - b.orderIndex;
    });
    this.updateProgressBar();
  }

  checkTasksForDate(date: Date): boolean {
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    return this.allTasks.some(task => {
      if (!task.dateTime) return false;
      const taskDate = new Date(task.dateTime);
      taskDate.setHours(0, 0, 0, 0);
      return this.isSameDay(taskDate, normalizedDate);
    });
  }

  // Antigo setViewModeAndSelectDay, adaptado (mantido para compatibilidade, mas não usado diretamente)
  setViewModeAndSelectDay(day: 'Hoje' | 'Amanhã' | 'Próximos 7 Dias'): void {
    // This method is no longer directly called by the day buttons.
    // It is kept for compatibility or can be removed if no longer used.
    // The new day selection logic is done by selectDayByDate(date: Date).
  }

  isSameDay(d1: Date, d2: Date): boolean {
    if (!d1 || !(d1 instanceof Date) || isNaN(d1.getTime()) ||
        !d2 || !(d2 instanceof Date) || isNaN(d2.getTime())) {
      console.warn('isSameDay received invalid date arguments:', d1, d2);
      return false;
    }
    return d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();
  }

  // Propriedades do Formulário de Nova Tarefa
  get formattedNewTaskDateDisplay(): string {
    if (this.newTaskDateTime && this.newTaskDateTime instanceof Date && !isNaN(this.newTaskDateTime.getTime())) {
      return this.datePipe.transform(this.newTaskDateTime, 'fullDate', 'pt-PT') || '';
    }
    return '';
  }

  resetNewTaskForm(): void {
    this.newTaskTitle = '';
    this.newTaskDescription = '';
    this.newTaskDateTime = this.selectedDate; // Inicializa com a data atualmente selecionada
    this.setNewTaskDateTimeBasedOnSelectedDay(); // Garante que a hora está correta
    this.newTaskPriority = 'Normal';
    this.isSelectionOccurring = false;
  }

  setNewTaskDateTimeBasedOnSelectedDay(): void {
    const now = new Date();
    const targetDate = (this.selectedDate instanceof Date && !isNaN(this.selectedDate.getTime())) ? this.selectedDate : now;
    
    this.newTaskDateTime = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      now.getMilliseconds()
    );

    if (isNaN(this.newTaskDateTime.getTime())) {
        console.warn('newTaskDateTime criado como Data Inválida, a reiniciar para agora.');
        this.newTaskDateTime = new Date();
    }
  }

  // Métodos de Gravação de Áudio
  onMicrophonePress(): void {
    if (this.isRecording) {
      return;
    }
    this.isHoldingMicrophone = true;
    this.recordingTimeout = setTimeout(() => {
      this.startRecording();
    }, 3000);
  }

  onMicrophoneRelease(): void {
    this.isHoldingMicrophone = false;
    clearTimeout(this.recordingTimeout);

    if (this.isRecording) {
      this.stopRecording();
    }
  }

  private async startRecording(): Promise<void> {
    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.audioStream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.addAudioTask(audioBlob);
        this.audioChunks = [];
        this.stopAudioStream();
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      this.messageService.add({ severity: 'info', summary: 'Gravação', detail: 'A gravar áudio...' });
    } catch (err: any) {
      console.error('Error accessing microphone:', err);
      this.messageService.add({ severity: 'error', summary: 'Erro de Microfone', detail: `Não foi possível aceder ao microfone: ${err.message}` });
      this.isRecording = false;
      this.isHoldingMicrophone = false;
      this.stopAudioStream();
    }
  }

  private stopRecording(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      this.messageService.add({ severity: 'success', summary: 'Gravação', detail: 'Gravação concluída!' });
    }
  }

  private stopAudioStream(): void {
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }
  }

  private async addAudioTask(audioBlob: Blob): Promise<void> {
    if (!this.userId) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Utilizador não autenticado para gravar áudio.' });
      return;
    }

    this.messageService.add({ severity: 'info', summary: 'Upload', detail: 'A enviar áudio...' });

    try {
      const tempTaskRef = doc(collection(this.firestore, 'tasks'));
      const tempTaskId = tempTaskRef.id;

      const audioUrl = await this.uploadAudio(audioBlob, tempTaskId);
      if (!audioUrl) {
        throw new Error('Falha ao obter a URL do áudio após o upload para o Cloudinary.');
      }

      const now = new Date();
      const taskTime = now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
      
      const newTask: Task = {
        id: tempTaskId,
        title: 'Gravação de Áudio',
        description: `Áudio gravado em ${now.toLocaleDateString('pt-PT')} às ${taskTime}`,
        dateTime: now,
        time: taskTime,
        priority: 'Normal',
        completed: false,
        userId: this.userId,
        orderIndex: this.allTasks.length,
        category: 'Áudio',
        audioUrl: audioUrl
      };

      await setDoc(tempTaskRef, newTask);

      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Áudio adicionado como tarefa!' });
      this.fetchTasks();
    } catch (error: any) {
      console.error('Error adding audio task:', error);
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao adicionar áudio como tarefa: ${error.message}` });
    }
  }

  private async uploadAudio(audioBlob: Blob, taskId: string): Promise<string> {
    const url = `https://api.cloudinary.com/v1_1/${this.CLOUDINARY_CLOUD_NAME}/auto/upload`;
    const formData = new FormData();
    formData.append('file', audioBlob);
    formData.append('upload_preset', this.CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', `task_manager_audio/${this.userId}`);

    try {
      const response: any = await this.http.post(url, formData).toPromise();
      if (response && response.secure_url) {
        return response.secure_url;
      }
      throw new Error('Cloudinary response did not contain secure_url');
    } catch (error: any) {
      console.error('Error uploading audio to Cloudinary:', error);
      this.messageService.add({ severity: 'error', summary: 'Erro de Upload', detail: `Falha ao enviar áudio para o Cloudinary: ${error.message}` });
      throw error;
    }
  }

  initializeAudioPlayer(audioUrl: string, taskId: string): void {
    if (this.audioPlayerInstances.has(taskId)) {
      return;
    }

    const audioEl = document.getElementById(`audio-${taskId}`) as HTMLAudioElement;
    const playButton = document.getElementById(`play-button-${taskId}`) as HTMLButtonElement;
    const progressBar = document.getElementById(`progress-bar-${taskId}`) as HTMLDivElement;
    const progressFill = progressBar ? (progressBar.querySelector('.progress-fill') as HTMLDivElement) : null;
    const progressHandle = progressBar ? (progressBar.querySelector('.progress-handle') as HTMLDivElement) : null;
    
    if (!audioEl || !playButton || !progressBar || !progressFill || !progressHandle) {
        console.warn(`Audio player elements not found for task ${taskId}. Skipping initialization.`);
        return;
    }

    audioEl.src = audioUrl;

    const playPauseIcon = playButton.querySelector('i');

    const togglePlayPause = () => {
      if (audioEl.paused) {
        this.audioPlayerInstances.forEach((p, id) => {
            if (id !== taskId && !p.audio.paused) {
                p.audio.pause();
                const otherPlayButtonIcon = p.playButton.querySelector('i');
                if (otherPlayButtonIcon) otherPlayButtonIcon.className = 'pi pi-play';
            }
        });
        audioEl.play();
      } else {
        audioEl.pause();
      }
    };

    playButton.onclick = togglePlayPause;

    audioEl.onplay = () => {
      if (playPauseIcon) playPauseIcon.className = 'pi pi-pause';
    };

    audioEl.onpause = () => {
      if (playPauseIcon) playPauseIcon.className = 'pi pi-play';
    };

    audioEl.ontimeupdate = () => {
      const percentage = (audioEl.currentTime / audioEl.duration) * 100;
      if (progressFill) progressFill.style.width = `${percentage}%`;
      if (progressHandle) progressHandle.style.left = `${percentage}%`;
    };

    audioEl.onended = () => {
      if (playPauseIcon) playPauseIcon.className = 'pi pi-play';
      if (progressFill) progressFill.style.width = '0%';
      if (progressHandle) progressHandle.style.left = '0%';
      audioEl.currentTime = 0; // Reset audio to start
    };

    let isDragging = false;
    if (progressBar) {
        progressBar.onmousedown = (e: MouseEvent) => {
            isDragging = true;
            updateProgress(e);
        };
        progressBar.ontouchstart = (e: TouchEvent) => {
            isDragging = true;
            updateProgress(e.touches[0]);
        };
    }

    const updateProgress = (e: MouseEvent | Touch) => {
        if (!isDragging || !progressBar) return;
        const rect = progressBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        let newTime = (clickX / rect.width) * audioEl.duration;
        newTime = Math.max(0, Math.min(newTime, audioEl.duration));
        audioEl.currentTime = newTime;
    };

    document.addEventListener('mousemove', (e: MouseEvent) => updateProgress(e));
    document.addEventListener('touchmove', (e: TouchEvent) => updateProgress(e.touches[0]));

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
        }
    });
    document.addEventListener('touchend', () => {
        if (isDragging) {
            isDragging = false;
        }
    });

    this.audioPlayerInstances.set(taskId, { audio: audioEl, progressBar: progressBar, playButton: playButton });
  }

  // Helper para extrair o Public ID da URL do Cloudinary
  private getPublicIdFromAudioUrl(audioUrl: string): string | null {
    if (!audioUrl) return null;
    const parts = audioUrl.split('/');
    const uploadIndex = parts.indexOf('upload');

    if (uploadIndex === -1 || uploadIndex + 1 >= parts.length) {
      return null;
    }

    let publicIdParts = parts.slice(uploadIndex + 1);
    if (publicIdParts.length > 0 && publicIdParts[0].startsWith('v')) {
      publicIdParts = publicIdParts.slice(1);
    }
    
    let publicId = publicIdParts.join('/');
    const lastDotIndex = publicId.lastIndexOf('.');
    if (lastDotIndex > 0) {
      publicId = publicId.substring(0, lastDotIndex);
    }
    return publicId;
  }

  // Tenta eliminar um ficheiro de áudio do Cloudinary.
  // ESTE MÉTODO CONTÉM VULNERABILIDADES DE SEGURANÇA SE USADO DIRETAMENTE NO FRONTEND COM API_SECRET.
  // APENAS PARA FINS DE DEMONSTRAÇÃO E TESTES EM AMBIENTES CONTROLADOS.
  private async deleteAudioFromCloudinary(publicId: string): Promise<void> {
    if (!publicId) {
      console.warn('Cloudinary delete: publicId is null or empty. Skipping deletion.');
      return;
    }

    console.warn(`!!! AVISO DE SEGURANÇA CRÍTICO !!! Tentando eliminar áudio do Cloudinary para o Public ID: ${publicId}`);
    console.warn('Expor o API Secret no frontend é UMA GRAVE VULNERABILIDADE. QUALQUER UM PODE APAGAR SEUS ARQUIVOS.');
    console.warn('Esta implementação É APENAS PARA DEMONSTRAÇÃO. PARA PRODUÇÃO, SEMPRE USE UM BACKEND SEGURO.');
    
    const timestamp = Math.floor(Date.now() / 1000);
    const string_to_sign = `public_id=${publicId}&timestamp=${timestamp}${this.CLOUDINARY_API_SECRET}`;
    const signature = CryptoJS.SHA1(string_to_sign).toString();

    const deleteUrl = `https://api.cloudinary.com/v1_1/${this.CLOUDINARY_CLOUD_NAME}/image/destroy`;
    
    const formData = new FormData();
    formData.append('public_id', publicId);
    formData.append('api_key', this.CLOUDINARY_API_KEY);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);

    try {
        const response: any = await this.http.post(deleteUrl, formData).toPromise();

        if (response && response.result === 'ok') {
            this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Ficheiro de áudio eliminado do Cloudinary!' });
        } else {
            this.messageService.add({ severity: 'error', summary: 'Erro de Eliminação', detail: `Falha ao eliminar áudio do Cloudinary.` });
        }

    } catch (error: any) {
        this.messageService.add({ severity: 'error', summary: 'Erro de Eliminação', detail: `Falha ao eliminar áudio do Cloudinary: ${error.message}` });
    }
  }


  // Métodos CRUD
  async fetchTasks(): Promise<void> {
    if (!this.userId) {
      this.currentTasks = [];
      this.allTasks = [];
      this.updateProgressBar();
      this.generateWeekDays(new Date());
      return;
    }

    this.isLoadingTasks = true;
    try {
      const q = query(collection(this.firestore, 'tasks'), where('userId', '==', this.userId));
      const querySnapshot = await getDocs(q);
      const tasks: Task[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        let taskDateTime: Date;
        if (data['dateTime'] && typeof data['dateTime'].seconds === 'number') {
          taskDateTime = new Date(data['dateTime'].seconds * 1000);
        } else {
          console.warn('Invalid or missing dateTime for task:', doc.id, data);
          taskDateTime = new Date();
        }

        const task: Task = {
          id: doc.id,
          title: data['title'],
          description: data['description'],
          dateTime: taskDateTime,
          time: data['time'] || taskDateTime.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
          priority: data['priority'],
          completed: data['completed'] || false,
          userId: data['userId'],
          originalDateTime: taskDateTime,
          orderIndex: data['orderIndex'] !== undefined ? data['orderIndex'] : 0,
          category: data['category'] || null,
          audioUrl: data['audioUrl'] || undefined,
        };
        tasks.push(task);
      });
      this.allTasks = tasks.sort((a, b) => {
        const dateA = a.dateTime instanceof Date && !isNaN(a.dateTime.getTime()) ? a.dateTime.getTime() : 0;
        const dateB = b.dateTime instanceof Date && !isNaN(b.dateTime.getTime()) ? b.dateTime.getTime() : 0;
        const dateComparison = dateA - dateB;
        if (dateComparison !== 0) {
          return dateComparison;
        }
        return a.orderIndex - b.orderIndex;
      });

      // NOVO: Limpa as instâncias do leitor de áudio para garantir a reinicialização correta
      this.audioPlayerInstances.forEach(player => player.audio.pause()); // Pausa qualquer áudio a tocar
      this.audioPlayerInstances.clear(); // Limpa o mapa

      if (this.selectedWeekRange && this.selectedWeekRange instanceof Date && !isNaN(this.selectedWeekRange.getTime())) {
        this.selectWeek(this.selectedWeekRange);
      } else {
        this.selectWeek(this.getStartOfWeek(new Date()));
      }
      this.updateProgressBar();
      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Tarefas carregadas!' });
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao carregar tarefas: ${error.message}` });
      console.error("Erro ao carregar tarefas:", error);
    } finally {
      this.isLoadingTasks = false;
    }
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
    const taskCategory: string | null = categoryMap[finalTaskTitle.toLowerCase()] || null;

    if (taskCategory === null && !this.groupedTasks.some(group => group.items.some(item => item.value.toLowerCase() === finalTaskTitle.toLowerCase()))) {
      this.newlyAddedTaskValue = finalTaskTitle;
      this.selectedCategoryForNewTask = null;
      this.currentEditingTask = null;
      this.displayCategoryDialog = true;
      return;
    }

    await this._performAddTask(finalTaskTitle, taskCategory);
  }

  private async _performAddTask(title: string, category: string | null): Promise<void> {
    const taskTime = this.newTaskDateTime!.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    const maxOrderIndexForSelectedDay = this.currentTasks.length > 0
      ? Math.max(...this.currentTasks.map(t => t.orderIndex))
      : -1;
    const newOrderIndex = maxOrderIndexForSelectedDay + 1;

    const newTask: Task = {
      title: title,
      description: this.newTaskDescription,
      dateTime: this.newTaskDateTime!,
      time: taskTime,
      priority: this.newTaskPriority,
      completed: false,
      userId: this.userId!,
      originalDateTime: this.newTaskDateTime!,
      orderIndex: newOrderIndex,
      category: category
    };

    try {
      const docRef = await addDoc(collection(this.firestore, 'tasks'), newTask);
      newTask.id = docRef.id;
      this.allTasks.push(newTask);
      
      this.fetchTasks();

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
      
      this.fetchTasks();

      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: `Tarefa ${task.completed ? 'concluída' : 'reaberta'}!` });
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao atualizar tarefa: ${error.message}` });
      console.error("Erro ao concluir tarefa:", error);
    }
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
    let taskCategory: string | null = categoryMap[finalTaskTitle.toLowerCase()] || null;

    const isEditedTitleNewAndUncategorized = !this.groupedTasks.some(group =>
      group.items.some(item => item.value.toLowerCase() === finalTaskTitle.toLowerCase())
    );

    if (isEditedTitleNewAndUncategorized) {
      this.newlyAddedTaskValue = finalTaskTitle;
      this.selectedCategoryForNewTask = null;
      this.currentEditingTask = task;
      this.displayCategoryDialog = true;
      return;
    }

    if (taskCategory === null && task.category !== null) {
      taskCategory = task.category;
    }

    await this._performSaveTask(task, finalTaskTitle, taskCategory);
  }

  private async _performSaveTask(task: Task, finalTaskTitle: string, taskCategory: string | null): Promise<void> {
    task.time = task.originalDateTime ? task.originalDateTime.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '';
    task.dateTime = task.originalDateTime || new Date();

    try {
      const taskRef = doc(this.firestore, 'tasks', task.id!);
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

      this.fetchTasks();

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

      this.fetchTasks();

    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao mover tarefa: ${error.message}` });
      console.error("Erro ao mover tarefa para o dia seguinte:", error);
    }
  }

  async drop(event: CdkDragDrop<Task[]>): Promise<void> {
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    const draggedTask = this.currentTasks[event.previousIndex];
    const targetTask = this.currentTasks[event.currentIndex];

    if (!draggedTask || !targetTask || !draggedTask.id || !targetTask.id) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Erro na operação de arrastar e soltar: Tarefa inválida ou ID em falta.' });
      return;
    }

    const originalDraggedDateTime = new Date(draggedTask.dateTime.getTime());
    const originalDraggedTime = draggedTask.time;

    const originalTargetDateTime = new Date(targetTask.dateTime.getTime());
    const originalTargetTime = targetTask.time;

    draggedTask.dateTime = originalTargetDateTime;
    draggedTask.time = originalTargetTime;

    targetTask.dateTime = originalDraggedDateTime;
    targetTask.time = originalDraggedTime;

    const batch = writeBatch(this.firestore);

    const draggedTaskRef = doc(this.firestore, 'tasks', draggedTask.id);
    batch.update(draggedTaskRef, {
      dateTime: draggedTask.dateTime,
      time: draggedTask.time,
    });

    const targetTaskRef = doc(this.firestore, 'tasks', targetTask.id);
    batch.update(targetTaskRef, {
      dateTime: targetTask.dateTime,
      time: targetTask.time,
    });

    try {
      await batch.commit();
      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Datas das tarefas trocadas!' });
      this.fetchTasks();
    } catch (error: any) {
      console.error("Erro ao trocar datas das tarefas:", error);
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao trocar datas das tarefas: ${error.message}` });
      
      // Reverter as alterações em memória se a atualização da base de dados falhar
      draggedTask.dateTime = originalDraggedDateTime;
      draggedTask.time = originalDraggedTime;
      targetTask.dateTime = originalTargetDateTime;
      targetTask.time = originalTargetTime;
    }
  }

  async deleteAllTasksForSelectedDay(): Promise<void> {
    if (!this.userId) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Utilizador não autenticado.' });
      return;
    }
    if (this.currentTasks.length === 0) {
      this.messageService.add({ severity: 'info', summary: 'Info', detail: `Não há tarefas para eliminar em "${this.datePipe.transform(this.selectedDate, 'fullDate', 'pt-PT')}".` });
      return;
    }

    const batch = writeBatch(this.firestore);
    const audioPublicIdsToDelete: string[] = [];

    this.currentTasks.forEach(task => {
      if (task.id) {
        batch.delete(doc(this.firestore, 'tasks', task.id));
        if (task.audioUrl) {
          const publicId = this.getPublicIdFromAudioUrl(task.audioUrl);
          if (publicId) {
            audioPublicIdsToDelete.push(publicId);
          }
        }
      }
    });

    try {
      await batch.commit();
      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: `Todas as tarefas de "${this.datePipe.transform(this.selectedDate, 'fullDate', 'pt-PT')}" foram eliminadas!` });

      for (const publicId of audioPublicIdsToDelete) {
        await this.deleteAudioFromCloudinary(publicId);
      }

      this.fetchTasks();
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao eliminar tarefas: ${error.message}` });
      console.error("Erro ao eliminar todas as tarefas do dia:", error);
    }
  }

  async removeTask(task: Task): Promise<void> {
    if (!task.id) return;

    try {
      // Removido a tentativa de exclusão do Cloudinary diretamente do frontend.
      // A Cloud Function cuidará disso.
      // if (task.audioUrl) {
      //   const publicId = this.getPublicIdFromAudioUrl(task.audioUrl);
      //   if (publicId) {
      //     await this.deleteAudioFromCloudinary(publicId);
      //   } else {
      //     console.warn(`Could not extract publicId for audioUrl: ${task.audioUrl}. Skipping Cloudinary deletion.`);
      //   }
      // }

      await deleteDoc(doc(this.firestore, 'tasks', task.id));
      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Tarefa eliminada! O ficheiro de áudio será removido em breve.' });

      this.fetchTasks();
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao eliminar tarefa: ${error.message}` });
      console.error("Erro ao eliminar tarefa:", error);
    }
  }

  async moveTask(task: Task, direction: 'up' | 'down'): Promise<void> {
    if (!task.id) return;

    const taskCurrentIndex = this.currentTasks.findIndex(t => t.id === task.id);
    let targetIndex = -1;

    if (direction === 'up' && taskCurrentIndex > 0) {
      targetIndex = taskCurrentIndex - 1;
    } else if (direction === 'down' && taskCurrentIndex < this.currentTasks.length - 1) {
      targetIndex = taskCurrentIndex + 1;
    } else {
      return;
    }

    const affectedTasks = [...this.currentTasks];
    const [movedTask] = affectedTasks.splice(taskCurrentIndex, 1);
    affectedTasks.splice(targetIndex, 0, movedTask);

    const batch = writeBatch(this.firestore);
    for (let i = 0; i < affectedTasks.length; i++) {
      const currentTaskInOrder = affectedTasks[i];
      if (currentTaskInOrder.orderIndex !== i) {
        const taskRef = doc(this.firestore, 'tasks', currentTaskInOrder.id!);
        batch.update(taskRef, { orderIndex: i });
        currentTaskInOrder.orderIndex = i;
      }
    }

    try {
      await batch.commit();
      this.fetchTasks();
      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Ordem da tarefa atualizada!' });
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao mover tarefa: ${error.message}` });
      console.error("Erro ao mover tarefa:", error);
    }
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
    const audioPublicIdsToDelete: string[] = [];

    this.allTasks.forEach(task => {
      if (task.id) {
        batch.delete(doc(this.firestore, 'tasks', task.id));
        if (task.audioUrl) {
          const publicId = this.getPublicIdFromAudioUrl(task.audioUrl);
          if (publicId) {
            audioPublicIdsToDelete.push(publicId);
          }
        }
      }
    });

    try {
      await batch.commit();
      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Todas as suas tarefas foram eliminadas!' });

      for (const publicId of audioPublicIdsToDelete) {
        await this.deleteAudioFromCloudinary(publicId);
      }

      this.fetchTasks();
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao eliminar todas as tarefas: ${error.message}` });
      console.error("Erro ao eliminar todas as tarefas do utilizador:", error);
    }
  }


  // Métodos de Categorização
  getCategoryMap(): { [key: string]: string } {
    const map: { [key: string]: string } = {};
    this.groupedTasks.forEach(group => {
      group.items.forEach(item => {
        map[item.value.toLowerCase()] = group.value || ''; // Use group.value for the category name
      });
    });
    return map;
  }

  get areOnlyDefaultCategoriesPresent(): boolean {
    if (this.groupedTasks.length === 0) return true;

    return this.groupedTasks.every(group => {
        const defaultMatch = this.defaultGroupedTasks.find(dg => dg.value === group.value);
        if (!defaultMatch) return false;
        return group.items.length === defaultMatch.items.length;
    });
  }

  cancelCategorization(): void {
    this.displayCategoryDialog = false;
    this.selectedCategoryForNewTask = null;
    this.currentEditingTask = null;
    this.resetNewTaskForm();
  }

  async categorizeTaskTitle(): Promise<void> {
    if (!this.selectedCategoryForNewTask || !this.newlyAddedTaskValue) {
      this.messageService.add({ severity: 'warn', summary: 'Atenção', detail: 'Selecione uma categoria.' });
      return;
    }

    const selectedGroupValue = this.selectedCategoryForNewTask.value.value;
    const selectedGroupLabel = this.selectedCategoryForNewTask.value.label;

    const targetGroup = this.groupedTasks.find(g => g.value === selectedGroupValue);

    if (targetGroup) {
      const itemExists = targetGroup.items.some(item => item.value.toLowerCase() === this.newlyAddedTaskValue.toLowerCase());
      if (!itemExists) {
        targetGroup.items.push({ label: this.newlyAddedTaskValue, value: this.newlyAddedTaskValue });
      }
    } else {
      this.groupedTasks.push({
        label: selectedGroupLabel,
        value: selectedGroupValue,
        items: [{ label: this.newlyAddedTaskValue, value: this.newlyAddedTaskValue }]
      });
    }

    this.updateAvailableCategories();
    await this.saveUserCategories();

    this.displayCategoryDialog = false;

    if (this.currentEditingTask) {
      this._performSaveTask(this.currentEditingTask, this.newlyAddedTaskValue, selectedGroupValue);
      this.currentEditingTask = null;
    } else {
      this._performAddTask(this.newlyAddedTaskValue, selectedGroupValue);
    }
    this.newlyAddedTaskValue = '';
    this.selectedCategoryForNewTask = null;
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

      const categoriesToStore = this.groupedTasks.filter(group => {
          const isDefaultGroup = this.defaultGroupedTasks.some(defaultGroup => defaultGroup.value === group.value);
          if (isDefaultGroup) {
              const defaultGroup = this.defaultGroupedTasks.find(dg => dg.value === group.value);
              return defaultGroup && group.items.length > defaultGroup.items.length;
          }
          return true;
      });

      if (!querySnapshot.empty) {
        const docRef = doc(this.firestore, 'userCategories', querySnapshot.docs[0].id);
        if (categoriesToStore.length > 0) {
            await updateDoc(docRef, { categories: categoriesToStore });
        } else {
            await deleteDoc(docRef);
        }
      } else {
        if (categoriesToStore.length > 0) {
            await addDoc(collection(this.firestore, 'userCategories'), {
                userId: this.userId,
                categories: categoriesToStore
            });
        }
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

    this.availableCategoriesForDeletion = this.groupedTasks
      .filter(group => !this.defaultGroupedTasks.some(defaultGroup => defaultGroup.value === group.value))
      .map(group => ({
        label: group.label,
        value: group
      }));
    
    if (this.selectedCategoryToDelete && !this.availableCategoriesForDeletion.some(cat => cat.value.value === this.selectedCategoryToDelete?.value.value)) {
        this.selectedCategoryToDelete = null;
    }
  }

  removeAutoCompleteItem(itemToRemove: TaskOption, event: Event): void {
    event.stopPropagation(); // Stop event propagation to prevent autocomplete from selecting
    event.preventDefault(); // Prevent default action

    this.confirmationService.confirm({
      message: `Tem a certeza que deseja remover o item "${itemToRemove.label}" da sua categoria?`,
      header: 'Confirmar Remoção',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sim',
      rejectLabel: 'Não',
      accept: async () => {
        let itemRemoved = false;
        this.groupedTasks.forEach(group => {
          const initialLength = group.items.length;
          group.items = group.items.filter(item => item.value.toLowerCase() !== itemToRemove.value.toLowerCase());
          if (group.items.length < initialLength) {
            itemRemoved = true;
          }
        });

        if (itemRemoved) {
          this.updateAvailableCategories();
          await this.saveUserCategories();
          this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Item removido da categoria.' });
        } else {
          this.messageService.add({ severity: 'info', summary: 'Info', detail: 'Item não encontrado na categoria.' });
        }
      }
    });
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
        filteredGroups.push({ label: group.label, items: filteredItems, value: group.value }); // Adicionei value
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
      this.newlyAddedTaskValue = currentInputValue;
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

    let currentInputValue: string = '';
    if (typeof task.title === 'object' && task.title !== null && 'value' in task.title) {
      currentInputValue = (task.title as TaskOption).value;
    } else if (typeof task.title === 'string') {
      currentInputValue = task.title;
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
      // Do nothing, categorization dialog will handle
    } else {
      task.title = currentInputValue;
    }
  }


  // Métodos de Ação da Tarefa
  editTask(task: Task): void {
    this.currentTasks.forEach(t => t.isEditing = false); // Fecha todas as outras edições
    task.isEditing = true;
    task.originalDateTime = new Date(task.dateTime.getTime()); // Cria uma cópia para edição
    this.currentEditingTask = task; // Define a tarefa que está a ser editada
  }

  cancelEdit(task: Task): void {
    task.isEditing = false;
    this.currentEditingTask = null; // Limpa a tarefa de edição
    this.fetchTasks(); // Re-fetch para reverter quaisquer alterações não salvas no UI
  }

  confirmDeleteSingleTask(event: Event | null, task: Task): void {
    this.confirmationService.confirm({
      target: event?.target || undefined,
      message: `Tem a certeza que deseja eliminar a tarefa "${task.title}"?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sim',
      rejectLabel: 'Não',
      accept: () => {
        this.removeTask(task);
      }
    });
  }

  confirmDeleteAllTasksToday(): void {
    this.confirmationService.confirm({
      message: `Tem a certeza que deseja eliminar TODAS as tarefas para "${this.datePipe.transform(this.selectedDate, 'fullDate', 'pt-PT')}"?`,
      header: 'Confirmar Eliminação',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sim',
      rejectLabel: 'Não',
      accept: () => {
        this.deleteAllTasksForSelectedDay();
      }
    });
  }

  confirmDeleteAllUserTasks(): void {
    this.confirmationService.confirm({
      message: `Tem a certeza que deseja eliminar TODAS as suas tarefas? Esta ação é irreversível.`,
      header: 'Confirmar Eliminação Global',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sim',
      rejectLabel: 'Não',
      accept: () => {
        this.deleteAllUserTasks();
      }
    });
  }

  confirmDeleteSelectedCategory(): void {
    if (!this.selectedCategoryToDelete) {
      this.messageService.add({ severity: 'warn', summary: 'Atenção', detail: 'Selecione uma categoria para eliminar.' });
      return;
    }

    const categoryLabel = this.selectedCategoryToDelete.label;
    const categoryValue = this.selectedCategoryToDelete.value.value;

    if (this.defaultGroupedTasks.some(group => group.value === categoryValue)) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Não pode eliminar categorias padrão.' });
      return;
    }

    this.confirmationService.confirm({
      message: `Tem a certeza que deseja eliminar a categoria "${categoryLabel}" e todos os seus itens? As tarefas com esta categoria NÃO serão eliminadas.`,
      header: 'Confirmar Eliminação de Categoria',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sim',
      rejectLabel: 'Não',
      accept: () => {
        this.deleteSelectedCategory(categoryValue);
      }
    });
  }

  async deleteSelectedCategory(categoryValue: string): Promise<void> {
    this.groupedTasks = this.groupedTasks.filter(group => group.value !== categoryValue);
    this.updateAvailableCategories();
    await this.saveUserCategories();
    this.selectedCategoryToDelete = null; // Clear selection after deletion
    this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Categoria eliminada com sucesso!' });
  }

  moveTaskUp(task: Task): void {
    this.moveTask(task, 'up');
  }

  moveTaskDown(task: Task): void {
    this.moveTask(task, 'down');
  }

  updateProgressBar(): void {
    if (this.currentTasks.length === 0) {
      this.progressSubject.next(0);
      return;
    }

    const completedTasks = this.currentTasks.filter(task => task.completed).length;
    const progress = (completedTasks / this.currentTasks.length) * 100;
    this.progressSubject.next(progress);
  }
  
  togglePedometer(): void {
    if (this.isPedometerActive) {
      this.stopPedometer();
    } else {
      this.startPedometer();
    }
  }

    startPedometer(): void {
    // Verifica se já existe um aviso, para não tentar iniciar se o sensor não for suportado
    if (this.pedometerWarning) {
      this.messageService.add({ severity: 'warn', summary: 'Pedómetro', detail: this.pedometerWarning });
      return;
    }
    if (this.isPedometerActive) return; // Evita múltiplas ativações

    this.stepsCount = 0; // Reinicia a contagem de passos
    this.lastMotionTime = 0;
    this.lastAccelerationMagnitude = 0;

    // Adiciona o event listener para o evento 'devicemotion'
    window.addEventListener('devicemotion', this.handleDeviceMotion.bind(this));
    this.isPedometerActive = true;
    this.messageService.add({ severity: 'success', summary: 'Pedómetro', detail: 'Pedómetro ativado. Comece a andar!' });
    console.log('Pedómetro ativado.');
  }

    stopPedometer(): void {
    if (!this.isPedometerActive) return;

    // Remove o event listener para o evento 'devicemotion'
    window.removeEventListener('devicemotion', this.handleDeviceMotion.bind(this));
    this.isPedometerActive = false;
    this.messageService.add({ severity: 'info', summary: 'Pedómetro', detail: 'Pedómetro desativado.' });
    console.log('Pedómetro desativado.');
  }

    private handleDeviceMotion(event: DeviceMotionEvent): void {
    const acceleration = event.accelerationIncludingGravity;

    if (acceleration && acceleration.x !== null && acceleration.y !== null && acceleration.z !== null) {
      const currentAccelerationMagnitude = this.getAccelerationMagnitude(acceleration);
      const currentTime = Date.now();

      // Detecta um "passo" se a mudança na magnitude da aceleração for significativa
      // e um tempo mínimo de debounce passou desde o último passo.
      if (Math.abs(currentAccelerationMagnitude - this.lastAccelerationMagnitude) > this.stepThreshold &&
          (currentTime - this.lastMotionTime) > this.debounceTime) {
        this.stepsCount++;
        this.lastMotionTime = currentTime;
      }
      this.lastAccelerationMagnitude = currentAccelerationMagnitude;
    }
  }

    private getAccelerationMagnitude(acceleration: any): number {
    return Math.sqrt(
      (acceleration.x || 0) * (acceleration.x || 0) +
      (acceleration.y || 0) * (acceleration.y || 0) +
      (acceleration.z || 0) * (acceleration.z || 0)
    );
  }

  // Speed Dial Items
  getSpeedDialItems(task: Task, allTasks: Task[]): MenuItem[] {
    const items: MenuItem[] = [];

    const taskIndexInCurrentTasks = this.currentTasks.findIndex(t => t.id === task.id);

    items.push({
      icon: 'pi pi-search-plus',
      tooltip: 'Ver Detalhes',
      // CORREÇÃO AQUI: Use MenuItemCommandEvent
      command: (event: MenuItemCommandEvent) => { 
        if (event.originalEvent) event.originalEvent.stopPropagation();
        this.viewTask(task);
      }
    });

    if (task.audioUrl && task.id) {
      items.push({
        icon: 'pi pi-play',
        tooltip: 'Reproduzir Áudio',
        // CORREÇÃO AQUI: Use MenuItemCommandEvent
        command: (event: MenuItemCommandEvent) => { 
          if (event.originalEvent) event.originalEvent.stopPropagation();
          const player = this.audioPlayerInstances.get(task.id!);
          if (player) {
            this.audioPlayerInstances.forEach((p, id) => {
              if (id !== task.id && !p.audio.paused) {
                p.audio.pause();
                const otherPlayButtonIcon = p.playButton.querySelector('i');
                if (otherPlayButtonIcon) otherPlayButtonIcon.className = 'pi pi-play';
              }
            });

            if (player.audio.paused) {
              player.audio.play();
            } else {
              player.audio.pause();
            }
          }
        }
      });
    }

    if (taskIndexInCurrentTasks > 0) {
      items.push({
        icon: 'pi pi-arrow-up',
        tooltip: 'Mover para Cima',
        // CORREÇÃO AQUI: Use MenuItemCommandEvent
        command: (event: MenuItemCommandEvent) => { 
          if (event.originalEvent) event.originalEvent.stopPropagation();
          this.moveTaskUp(task);
        }
      });
    }
    if (taskIndexInCurrentTasks < this.currentTasks.length - 1) {
      items.push({
        icon: 'pi pi-arrow-down',
        tooltip: 'Mover para Baixo',
        // CORREÇÃO AQUI: Use MenuItemCommandEvent
        command: (event: MenuItemCommandEvent) => { 
          if (event.originalEvent) event.originalEvent.stopPropagation();
          this.moveTaskDown(task);
        }
      });
    }

    items.push({
      icon: 'pi pi-check',
      tooltip: 'Completar Tarefa',
      disabled: task.completed,
      // CORREÇÃO AQUI: Use MenuItemCommandEvent
      command: (event: MenuItemCommandEvent) => { 
        if (event.originalEvent) event.originalEvent.stopPropagation();
        this.completeTask(task);
      }
    });

    items.push({
      icon: 'pi pi-pencil',
      tooltip: 'Editar Tarefa',
      // CORREÇÃO AQUI: Use MenuItemCommandEvent
      command: (event: MenuItemCommandEvent) => { 
        if (event.originalEvent) event.originalEvent.stopPropagation();
        this.editTask(task);
      }
    });

    items.push({
      icon: 'pi pi-arrow-right',
      tooltip: 'Mover para o Dia Seguinte',
      // CORREÇÃO AQUI: Use MenuItemCommandEvent
      command: (event: MenuItemCommandEvent) => { 
        if (event.originalEvent) event.originalEvent.stopPropagation();
        this.moveTaskToNextDay(task);
      }
    });

    items.push({
      icon: 'pi pi-trash',
      tooltip: 'Remover Tarefa',
      // CORREÇÃO AQUI: Use MenuItemCommandEvent
      command: (event: MenuItemCommandEvent) => {
        if (event.originalEvent) event.originalEvent.stopPropagation();
        this.confirmDeleteSingleTask(null, task);
      }
    });

    return items;
  }

    confirmDeleteAllCategories(): void {
    this.confirmationService.confirm({
      message: 'Tem a certeza que deseja eliminar TODAS as suas categorias personalizadas? As categorias padrão serão mantidas. Esta ação não pode ser desfeita.',
      header: 'Eliminar Todas as Categorias',
      icon: 'pi pi-exclamation-triangle',
      acceptIcon: 'pi pi-trash',
      rejectIcon: 'pi times',
      acceptButtonProps: {
        label: 'Sim',
        severity: 'success',
        outlined: false
      },
      rejectButtonProps: {
        label: 'Não',
        severity: 'danger',
        outlined: true
      },
      accept: () => {
        this.deleteAllCategories();
      },
      reject: () => {
        this.messageService.add({ severity: 'info', summary: 'Cancelado', detail: 'A eliminação de todas as categorias foi cancelada.' });
      }
    });
  }

    async deleteAllCategories(): Promise<void> {
    if (!this.userId) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Utilizador não autenticado.' });
      return;
    }

    try {
      const q = query(collection(this.firestore, 'userCategories'), where('userId', '==', this.userId));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // Assuming there's only one document per user for categories
        const docRef = doc(this.firestore, 'userCategories', querySnapshot.docs[0].id);
        await deleteDoc(docRef);

        // Reset local categories to default
        this.groupedTasks = JSON.parse(JSON.stringify(this.defaultGroupedTasks));
        this.updateAvailableCategories();
        this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Todas as categorias personalizadas foram eliminadas!' });
      } else {
        this.messageService.add({ severity: 'info', summary: 'Info', detail: 'Nenhuma categoria personalizada para eliminar.' });
      }
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao eliminar categorias: ${error.message}` });
      console.error("Erro ao eliminar todas as categorias:", error);
    }
  }
}

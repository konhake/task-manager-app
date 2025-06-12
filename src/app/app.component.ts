import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common'; // Adicionar DatePipe aqui
import { FormsModule } from '@angular/forms';
import { Auth, GoogleAuthProvider, signInWithPopup, signOut, user } from '@angular/fire/auth';
import { Firestore, collection, addDoc, query, where, getDocs, doc, updateDoc, deleteDoc, writeBatch, getDoc, setDoc } from '@angular/fire/firestore';
import { Observable, Subscription, BehaviorSubject } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ConfirmationService, MenuItem, SelectItem } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext'; // Corrigido a importação
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
import { BadgeModule } from 'primeng/badge'; // Importar BadgeModule
import { DividerModule } from 'primeng/divider';

import { trigger, state, style, animate, transition } from '@angular/animations';

// Definições de Interfaces (Adicionadas ou atualizadas para incluir 'category')
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

// NOVA INTERFACE: Para representar os dias da semana na linha temporal
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
    BadgeModule, // Adicionar BadgeModule aos imports
    DividerModule
  ],
  providers: [MessageService, ConfirmationService, DatePipe],
    animations: [
    trigger('fadeInOut', [
      // Estado 'void' é quando o elemento ainda não está no DOM ou já foi removido.
      state('void', style({
        opacity: 0,
        transform: 'translateY(20px)' // Começa 20px abaixo para fadeInDown na entrada
      })),
      // Transição de entrada (quando o elemento aparece)
      transition('void => *', [
        animate('0.5s ease-out', style({
          opacity: 1,
          transform: 'translateY(0)' // Move para a posição final
        }))
      ]),
      // Transição de saída (quando o elemento desaparece)
      transition('* => void', [
        animate('0.5s ease-out', style({
          opacity: 0,
          transform: 'translateY(-20px)' // Move 20px para cima ao desaparecer (fadeInUp)
        }))
      ])
    ])
  ], // Adicionar DatePipe aos providers
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
export class AppComponent implements OnInit, OnDestroy {
  // Injeções de Dependência
  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);
  private messageService: MessageService = inject(MessageService);
  private confirmationService: ConfirmationService = inject(ConfirmationService);
  private datePipe: DatePipe = inject(DatePipe); // Injetar DatePipe

  // Propriedades de Autenticação e Utilizador
  userLoggedIn: boolean = false;
  userName: string = 'Convidado';
  userPhotoUrl: string | null = null;
  userId: string | null = null;
  private userSubscription: Subscription | null = null;
  isLoadingAuth: boolean = true;

  // Propriedades de Gestão de Tarefas
  // days: string[] = ['Hoje', 'Amanhã', 'Próximos 7 Dias']; // Removido
  selectedDay: string = 'Hoje'; // Mantido para compatibilidade, mas o filtro será por selectedDate
  selectedDate: Date = new Date(); // NOVO: Para a data selecionada na linha do tempo
  weekDays: WeekDay[] = []; // NOVO: Array para a linha temporal da semana
  currentTasks: Task[] = [];
  allTasks: Task[] = [];
  isLoadingTasks: boolean = false;

  // NOVO: Variável para controlar qual secção de conteúdo está visível
  viewMode: 'addTask' | 'timeline' | 'expandedTask' = 'timeline'; // Alterado para 'timeline' por padrão
  selectedTask: Task | null = null; // NOVO: Para armazenar a tarefa selecionada para visualização expandida

    // NOVO: Propriedade para controlar a visibilidade dos botões de gestão
  showDeleteOptions: boolean = false;

  selectedWeekRange: Date | any = null;
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

  // NOVO: Propriedade para minDate do p-calendar
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

  // NOVO: Propriedade para controlar a tarefa sendo editada (se houver)
  currentEditingTask: Task | null = null;

  // NOVAS PROPRIEDADES PARA ELIMINAÇÃO DE CATEGORIAS
  selectedCategoryToDelete: SelectItem | null = null;
  availableCategoriesForDeletion: SelectItem[] = [];

  // NOVAS PROPRIEDADES PARA O DIÁLOGO DE DEPLOY
  currentAppVersion: string = '1.0.1'; // Definir a versão atual da aplicação
  displayDeployDialog: boolean = false;
  deployVersion: string = '';


  constructor() { }

  async ngOnInit(): Promise<void> {
    this.userSubscription = user(this.auth).subscribe(async firebaseUser => {
      if (firebaseUser) {
        this.userLoggedIn = true;
        this.userName = firebaseUser.displayName || firebaseUser.email || 'Utilizador';
        this.userPhotoUrl = firebaseUser.photoURL;
        this.userId = firebaseUser.uid;
        this.isLoadingAuth = false;
        
        this.generateWeekRanges(); // Generate week ranges
        this.selectCurrentWeek(); // Select the current week initially

        await this.loadUserCategories();
        // Adicionado para depuração: Log de groupedTasks após o carregamento
        await this.fetchTasks();
        if (!this.dailyTransitionDone) {
          await this.transitionOverdueTasks();
          this.dailyTransitionDone = true;
        }
        this.generateWeekDays(); // Gera os dias da semana após carregar as tarefas
        this.selectDayByDate(new Date()); // Seleciona o dia de hoje por padrão
        await this.checkAppVersion(); // Chama a verificação da versão após o login
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
        this.generateWeekDays(); // Gerar mesmo sem login
        this.generateWeekRanges(); // Generate even without login to show options
        this.selectCurrentWeek();
      }
    });

    this.searchGrouped({ query: '' });
  }

  ngOnDestroy(): void {
    this.userSubscription?.unsubscribe();
    this.progressSubject.complete();
  }

  // NOVO MÉTODO: Verifica e notifica sobre novas versões
  async checkAppVersion(): Promise<void> {
    if (!this.userId) return;

    try {
      const userSettingsRef = doc(this.firestore, `artifacts/__app_id/users/${this.userId}/userSettings/userSettings`);
      const docSnap = await getDoc(userSettingsRef);
      let lastSeenVersion = '0.0.0'; // Versão inicial se não houver registro

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && data['lastSeenAppVersion']) {
          lastSeenVersion = data['lastSeenAppVersion'];
        }
      }

      // Comparação simples de versões (funciona para X.Y.Z se X, Y, Z forem números inteiros e crescentes)
      // Para um controle de versão mais robusto (semver), seria necessário uma biblioteca.
      const isNewVersion = this.compareVersions(this.currentAppVersion, lastSeenVersion);

      if (isNewVersion) {
        this.deployVersion = this.currentAppVersion;
        this.displayDeployDialog = true;
      }

      // Atualiza a versão vista pelo utilizador no Firestore
      await setDoc(userSettingsRef, { lastSeenAppVersion: this.currentAppVersion }, { merge: true });

    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao verificar versão: ${error.message}` });
    }
  }

  // Método auxiliar para comparar versões (string-based, para formato X.Y.Z)
  private compareVersions(v1: string, v2: string): boolean {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;

      if (p1 > p2) return true;
      if (p1 < p2) return false;
    }
    return false; // As versões são iguais ou v1 não é maior que v2
  }

  closeDeployDialog(): void {
    this.displayDeployDialog = false;
  }

  // NOVO MÉTODO: Controla a exibição das seções de conteúdo
  setViewMode(mode: 'addTask' | 'timeline' | 'expandedTask'): void {
    this.viewMode = mode;
    if (mode === 'addTask') {
      this.resetNewTaskForm(); // Limpa o formulário quando o modo é 'Nova Tarefa'
    } else if (mode === 'timeline') {
      // Quando volta para a timeline, re-filtra pela semana atualmente selecionada
      if (this.selectedWeekRange && this.selectedWeekRange instanceof Date && !isNaN(this.selectedWeekRange.getTime())) {
        this.selectWeek(this.selectedWeekRange); // selectWeek agora define selectedDate
      } else {
        // Fallback para a data atual se selectedWeekRange não for válido
        this.selectWeek(this.getStartOfWeek(new Date())); // selectWeek agora define selectedDate
      }
      this.selectedTask = null; // Limpa a tarefa selecionada
    }
  }

  // NOVO MÉTODO: Para visualizar uma tarefa em modo expandido
  viewTask(task: Task): void {
    this.selectedTask = task;
    this.viewMode = 'expandedTask';
  }

  // NOVO MÉTODO: Para voltar à lista de tarefas
  backToTimeline(): void {
    this.selectedTask = null;
    this.viewMode = 'timeline';
    // Ao voltar para a timeline, certifique-se de que o filtro é pela semana selecionada
    if (this.selectedWeekRange && this.selectedWeekRange instanceof Date && !isNaN(this.selectedWeekRange.getTime())) {
      this.selectWeek(this.selectedWeekRange); // selectWeek agora define selectedDate
    } else {
      // Fallback para a data atual se selectedWeekRange não for válido
      this.selectWeek(this.getStartOfWeek(new Date())); // selectWeek agora define selectedDate
    }
  }

    // NOVO MÉTODO: Toggle para os botões de gestão (eliminar)
  toggleDeleteOptions(): void {
    this.showDeleteOptions = !this.showDeleteOptions;
  }


  // NOVO MÉTODO: Gera os dias da semana para a linha temporal
  generateWeekDays(startDate: Date = new Date()): void {
    this.weekDays = [];
    // Ensure startDate is a valid Date object before proceeding
    const validStartDate = (startDate instanceof Date && !isNaN(startDate.getTime())) ? startDate : new Date();
    const start = this.getStartOfWeek(validStartDate); // Ensure the week starts on a Monday


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

    // NEW METHOD: Generates week ranges for the dropdown
  generateWeekRanges(): void {
    this.availableWeekRanges = [];
    const today = new Date(); 

    // Alterado: Gerar a semana atual (i=0) e as próximas 4 semanas (total de 5 semanas)
    // Adjust the loop range as needed: i=0 for current week, up to i=N for N future weeks.
    for (let i = 0; i <= 4; i++) { // ALERADO AQUI: Começa em 0 e vai até 4
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
      this.selectedWeekRange = currentWeekOption.value as Date; // Atribui a Date diretamente
      this.selectWeek(currentWeekOption.value as Date); 
      // Atribuição de this.selectedDate REMOVIDA daqui.
    } else {
      this.selectedWeekRange = startOfTodayWeek; // Atribui a Date diretamente
      this.selectWeek(startOfTodayWeek);
      // Atribuição de this.selectedDate REMOVIDA daqui.
    }
  }

// Helper para obter o início da semana (segunda-feira)
  getStartOfWeek(date: Date): Date {
    const d = new Date(date);
    if (isNaN(d.getTime())) { // Adicionada esta validação
        console.error('getStartOfWeek: A data de entrada resultou num objeto Date Inválido. Entrada:', date);
        return new Date(); // Retorna uma data de fallback válida
    }
    const dayOfWeek = d.getDay(); // 0 (Domingo) a 6 (Sábado)

    // Calcula quantos dias subtrair para chegar à segunda-feira
    // Se for domingo (0), subtrai 6 para ir para a segunda-feira anterior
    // Caso contrário, subtrai (dia da semana - 1)
    const dayDifference = (dayOfWeek === 0) ? 6 : dayOfWeek - 1;

    d.setDate(d.getDate() - dayDifference);
    d.setHours(0, 0, 0, 0); // Zera as horas para evitar problemas de comparação de datas
    return d;
  }

  // NEW METHOD: Handler for week range selection in the dropdown
  onWeekRangeSelect(event: { originalEvent: Event, value: Date }): void {
    // selectedWeekRange já é atualizado pelo [(ngModel)] e optionValue="value"

    // Lógica de atribuição de this.selectedDate REMOVIDA daqui, agora é feita em selectWeek()

    this.selectWeek(event.value); // Chame a lógica de seleção de semana
  }

  // NEW METHOD: Central logic for week selection and UI update
  selectWeek(startDate: Date): void {

    // Define a data que será usada para destacar o dia na linha temporal e no cabeçalho
    // e também para inicializar o formulário de nova tarefa.
    if (this.isSameDay(startDate, this.getStartOfWeek(new Date()))) {
      // Se a semana é a semana atual, seleciona o dia de hoje
      this.selectedDate = new Date();
    } else {
      // Caso contrário, seleciona o primeiro dia da semana (que é o `startDate` recebido)
      this.selectedDate = startDate;
    }

    this.generateWeekDays(startDate); // Gerar a linha temporal dos dias para esta semana (com base no startDate do DROPDOWN)
    this.filterTasksBySelectedDay(this.selectedDate); // ALTERADO: Agora filtra pelo dia selecionado, não pela semana inteira
    this.setNewTaskDateTimeBasedOnSelectedDay(); // Atualizar data do formulário de nova tarefa (AGORA USA selectedDate ATUALIZADO)
    this.viewMode = 'timeline'; // Garante visualização da timeline
  }

    // NEW METHOD: Selects a day from the timeline and filters tasks ONLY for that day
  selectDayByDate(date: Date): void {
    this.selectedDate = date; // Atualiza a data selecionada para o dia clicado

    // Calcular o início da semana para a data clicada
    const startOfWeekForClickedDate = this.getStartOfWeek(date);

    // Verificar se a data clicada pertence à semana atualmente selecionada no dropdown
    if (this.selectedWeekRange && this.selectedWeekRange instanceof Date && !isNaN(this.selectedWeekRange.getTime())) {
      const currentSelectedWeekStart = this.selectedWeekRange;
      const currentSelectedWeekEnd = new Date(currentSelectedWeekStart);
      currentSelectedWeekEnd.setDate(currentSelectedWeekEnd.getDate() + 6);
      currentSelectedWeekEnd.setHours(23, 59, 59, 999);

      // Se o dia clicado está DENTRO da semana atualmente selecionada, manter o dropdown
      if (date.getTime() >= currentSelectedWeekStart.getTime() && date.getTime() <= currentSelectedWeekEnd.getTime()) {
        // Não fazemos nada aqui, o selectedWeekRange mantém o seu valor.
      } else {
        // Se o dia clicado está FORA do intervalo da semana atual, atualizamos o dropdown
        this.updateSelectedWeekRangeFromTimeline(date); // Atualiza o valor do dropdown
      }
    } else {
      // Se nenhum intervalo de semana está atualmente selecionado no dropdown,
      // definimos o selectedWeekRange para a semana do dia clicado.
      this.updateSelectedWeekRangeFromTimeline(date); // Atualiza o valor do dropdown
    }

    this.filterTasksBySelectedDay(date); // Filtra tarefas para o dia específico
    this.setNewTaskDateTimeBasedOnSelectedDay(); // Atualiza a data do formulário de nova tarefa
    this.viewMode = 'timeline'; // Garante que a visualização da timeline é ativa
  }

  // NEW METHOD: Filters tasks for a SINGLE specific date
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

  // NEW METHOD: Filters tasks for an ENTIRE WEEK
  filterTasksBySelectedWeek(startDate: Date): void {
    const weekStart = new Date(startDate);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(startDate);
    weekEnd.setDate(weekEnd.getDate() + 6); // Add 6 days to go until the end of Sunday of the week
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

  // NOVO MÉTODO: Verifica se há tarefas para uma data específica
  checkTasksForDate(date: Date): boolean {
    // Normaliza a data de entrada para comparação
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    return this.allTasks.some(task => {
      if (!task.dateTime) return false;
      const taskDate = new Date(task.dateTime);
      taskDate.setHours(0, 0, 0, 0);
      return this.isSameDay(taskDate, normalizedDate);
    });
  }

  // Antigo setViewModeAndSelectDay, adaptado
  setViewModeAndSelectDay(day: 'Hoje' | 'Amanhã' | 'Próximos 7 Dias'): void {
    // Este método não é mais chamado diretamente pelos botões de dia.
    // Ele será mantido para compatibilidade ou pode ser removido se não houver mais uso.
    // A nova lógica de seleção de dia é feita por selectDayByDate(date: Date).
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

      const customCategoriesToSave = this.groupedTasks.filter(group => !this.defaultGroupedTasks.some(defaultGroup => defaultGroup.value === group.value))
                                      .map(group => ({
                                          label: group.label,
                                          value: group.value,
                                          items: group.items
                                      }));
      
      // Merge custom categories with default categories for saving.
      // We only store *user-defined* categories in Firestore. Default categories are always present.
      const categoriesToStore = this.groupedTasks.filter(group => {
          // Only store groups that are NOT default groups OR are default groups but have custom items
          const isDefaultGroup = this.defaultGroupedTasks.some(defaultGroup => defaultGroup.value === group.value);
          if (isDefaultGroup) {
              const defaultGroup = this.defaultGroupedTasks.find(dg => dg.value === group.value);
              // Only save if the default group has added items not in its original default list
              return defaultGroup && group.items.length > defaultGroup.items.length;
          }
          return true; // It's a completely custom group, so save it
      });



      if (!querySnapshot.empty) {
        const docRef = doc(this.firestore, 'userCategories', querySnapshot.docs[0].id);
        if (categoriesToStore.length > 0) {
            await updateDoc(docRef, { categories: categoriesToStore });
        } else {
            // If no custom categories left, delete the document
            await deleteDoc(docRef);
        }
      } else {
        if (categoriesToStore.length > 0) {
            await addDoc(collection(this.firestore, 'userCategories'), {
                userId: this.userId,
                categories: categoriesToStore
            });
        } else {
        }
      }
      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Categorias salvas com sucesso!' });
      // Adicionado para depuração: Log de groupedTasks após o salvamento
    } catch (error: any) {
      console.error("Erro ao salvar categorias do utilizador:", error);
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao salvar categorias: ${error.message}` });
    }
  }

  // NOVO MÉTODO: Atualiza as opções do dropdown de categorias
  updateAvailableCategories(): void {
    this.availableCategories = this.groupedTasks.map(group => ({
      label: group.label,
      value: group // PrimeNG Dropdown expects 'value' to be the whole object or primitive
    }));

    // Populate categories for deletion, including only custom categories
    this.availableCategoriesForDeletion = this.groupedTasks
      .filter(group => !this.defaultGroupedTasks.some(defaultGroup => defaultGroup.value === group.value))
      .map(group => ({
        label: group.label,
        value: group
      }));
    
    // Reset selectedCategoryToDelete if it no longer exists
    if (this.selectedCategoryToDelete && !this.availableCategoriesForDeletion.some(cat => cat.value.value === this.selectedCategoryToDelete?.value.value)) {
        this.selectedCategoryToDelete = null;
    }
  }

  isSameDay(d1: Date, d2: Date): boolean {
    // Adicionado: Verificação para garantir que d1 e d2 são objetos Date válidos
    if (!d1 || !(d1 instanceof Date) || isNaN(d1.getTime()) ||
        !d2 || !(d2 instanceof Date) || isNaN(d2.getTime())) {
      console.warn('isSameDay recebeu argumentos de data inválidos:', d1, d2);
      return false;
    }
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

  getSpeedDialItems(task: Task, allTasks: Task[]): MenuItem[] {
    const items: MenuItem[] = [];
    const taskIndex = allTasks.findIndex(t => t.id === task.id);

    // Adicionado: Botão "Ver Detalhes" para expandir a tarefa
    items.push({ icon: 'pi pi-search-plus', tooltip: 'Ver Detalhes', command: () => this.viewTask(task) });

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
    // Apenas preenche newlyAddedTaskValue se for um novo item, mas não abre o diálogo aqui.
    // O diálogo será aberto pelo método addTask se o item não estiver categorizado.
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
    // Este método agora apenas preenche newlyAddedTaskValue e currentEditingTask
    // se o item não existir. O diálogo de categorização será aberto por saveTask().
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
      this.newlyAddedTaskValue = currentInputValue;
      this.currentEditingTask = task; // Mantém a tarefa em edição para contexto
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
        group => group.value === (this.selectedCategoryForNewTask?.value as TaskGroup)?.value
      );

      if (targetGroup) {
        if (!targetGroup.items.some(item => item.value.toLowerCase() === newTaskOption.value.toLowerCase())) {
          targetGroup.items.push(newTaskOption);
          await this.saveUserCategories();
        } else {
          this.messageService.add({ severity: 'warn', summary: 'Atenção', detail: 'Essa sugestão já existe nesta categoria.' });
        }

        // Se a categorização foi para uma NOVA tarefa (não edição)
        if (this.currentEditingTask === null) {
          // Define o newTaskTitle com o valor categorizado
          this.newTaskTitle = newTaskOption.value;
          // E agora, procede com a adição da tarefa
          await this._performAddTask(this.newTaskTitle, targetGroup.label);
        } else {
          // Se a categorização foi para uma tarefa em EDIÇÃO
          this.currentEditingTask.title = newTaskOption.value;
          this.currentEditingTask.category = targetGroup.label;
          // Procede com o salvamento da tarefa editada
          await this._performSaveTask(this.currentEditingTask, newTaskOption.value, targetGroup.label);
        }

      } else {
        console.warn('Grupo selecionado não encontrado para categorização.');
      }
      this.resetCategoryDialog();
    }
  }

  cancelCategorization() {
    // Se estiver a editar e cancelar a categorização, o diálogo fecha.
    // O utilizador ainda pode cancelar a edição da tarefa.
    if (this.currentEditingTask) {
      // Poderíamos resetar o task.title para o seu valor original ou um valor vazio
      // Por agora, vamos apenas fechar o diálogo. O utilizador pode cancelar a edição da tarefa.
    } else {
      // Se for uma nova tarefa e o usuário cancelar a categorização, limpa o título da nova tarefa
      this.newTaskTitle = '';
    }
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
      // Ensure generateWeekDays receives a valid date
      this.generateWeekDays(new Date()); // Default to current week start if no userId
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
        // defensive check for dateTime from Firestore
        if (data['dateTime'] && typeof data['dateTime'].seconds === 'number') {
          taskDateTime = new Date(data['dateTime'].seconds * 1000);
        } else {
          // Fallback if dateTime is invalid or missing
          console.warn('Invalid or missing dateTime for task:', doc.id, data);
          taskDateTime = new Date(); // Default to current date
        }

        const task: Task = {
          id: doc.id,
          title: data['title'],
          description: data['description'],
          dateTime: taskDateTime,
          time: data['time'] || taskDateTime.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }), // Ensure time is generated if missing
          priority: data['priority'],
          completed: data['completed'] || false,
          userId: data['userId'],
          originalDateTime: taskDateTime, // Use the same validated dateTime
          orderIndex: data['orderIndex'] !== undefined ? data['orderIndex'] : 0,
          category: data['category'] || null,
        };
        tasks.push(task);
      });
      this.allTasks = tasks.sort((a, b) => {
        // Ensure valid dates for sorting
        const dateA = a.dateTime instanceof Date && !isNaN(a.dateTime.getTime()) ? a.dateTime.getTime() : 0;
        const dateB = b.dateTime instanceof Date && !isNaN(b.dateTime.getTime()) ? b.dateTime.getTime() : 0;
        const dateComparison = dateA - dateB;
        if (dateComparison !== 0) {
          return dateComparison;
        }
        return a.orderIndex - b.orderIndex;
      });

      // Após carregar todas as tarefas, selecione a semana e atualize a UI via selectWeek()
      if (this.selectedWeekRange && this.selectedWeekRange instanceof Date && !isNaN(this.selectedWeekRange.getTime())) {
        this.selectWeek(this.selectedWeekRange); // AGORA CHAMA selectWeek()
      } else {
        this.selectWeek(this.getStartOfWeek(new Date())); // AGORA CHAMA selectWeek()
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

  // NOVO MÉTODO PRIVADO: Contém a lógica de adição real da tarefa
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
      this.allTasks.push(newTask); // Atualiza a lista local

      // Apenas chama fetchTasks para re-sincronizar tudo.
      this.fetchTasks(); // ALTERADO

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
      task.completed = !task.completed; // Atualiza o estado local

      // Apenas chama fetchTasks para re-sincronizar tudo.
      this.fetchTasks(); // ALTERADO

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
    // Ensure originalDateTime is always a valid Date object when entering edit mode
    task.originalDateTime = (task.dateTime instanceof Date && !isNaN(task.dateTime.getTime())) 
                            ? new Date(task.dateTime.getTime()) 
                            : new Date(); // Fallback to current date if invalid
    this.currentEditingTask = null; // Reset to ensure only one is being edited at a time
  }

  cancelEdit(task: Task): void {
    task.isEditing = false;
    this.currentEditingTask = null;
    this.fetchTasks(); // Reverte as alterações ao buscar as tarefas novamente
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

    // Adicionado para depuração
    const categoryMap = this.getCategoryMap();
    let taskCategory: string | null = categoryMap[finalTaskTitle.toLowerCase()] || null;

    // Verifica se o título editado NÃO existe em nenhuma categoria existente
    const isEditedTitleNewAndUncategorized = !this.groupedTasks.some(group =>
      group.items.some(item => item.value.toLowerCase() === finalTaskTitle.toLowerCase())
    );


    // Se a tarefa editada precisa de categorização (porque o título é novo e não categorizado), abre o diálogo
    if (isEditedTitleNewAndUncategorized) {
      this.newlyAddedTaskValue = finalTaskTitle;
      this.selectedCategoryForNewTask = null; // Reseta seleção no diálogo
      this.currentEditingTask = task; // Define a tarefa que está sendo editada
      this.displayCategoryDialog = true; // Abre o diálogo
      return; // Para a execução aqui
    }

    // Se já está categorizada ou foi categorizada pelo diálogo, continua com o salvamento
    // Se a categoria era null e não foi categorizada no diálogo, mantém null
    if (taskCategory === null && task.category !== null) {
      taskCategory = task.category; // Mantém a categoria antiga se a nova não foi encontrada
    }

    await this._performSaveTask(task, finalTaskTitle, taskCategory);
  }

  // NOVO MÉTODO PRIVADO: Contém a lógica de salvamento real da tarefa editada
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
        category: taskCategory, // Já garantido que é string ou null
      });
      task.isEditing = false;
      this.currentEditingTask = null;

      // Apenas chama fetchTasks para re-sincronizar tudo.
      this.fetchTasks(); // ALTERADO

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

      task.dateTime = nextDay; // Atualiza o objeto local (opcional, fetchTasks vai buscar a DB)
      task.time = taskTime; // Atualiza o objeto local (opcional, fetchTasks vai buscar a DB)
      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: `Tarefa "${task.title}" movida para ${nextDay.toLocaleDateString()}!` });

      // Apenas chama fetchTasks para re-sincronizar tudo.
      this.fetchTasks(); // ALTERADO

    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao mover tarefa: ${error.message}` });
      console.error("Erro ao mover tarefa para o dia seguinte:", error);
    }
  }

  confirmDeleteSingleTask(event: Event | null, task: Task) {
    this.confirmationService.confirm({
      message: `Tem a certeza que deseja eliminar a tarefa "${task.title}"? Esta ação não pode ser desfeita.`,
      icon: 'pi pi-exclamation-triangle',
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
        this.removeTask(task);
      },
      reject: () => {
        this.messageService.add({ severity: 'info', summary: 'Cancelado', detail: 'A eliminação da tarefa foi cancelada.' });
      }
    });
  }

  confirmDeleteAllTasksToday() {
    const dayName = this.datePipe.transform(this.selectedDate, 'fullDate', 'pt-PT'); // Usa DatePipe para o nome do dia
    this.confirmationService.confirm({
      message: `Tem a certeza que deseja eliminar TODAS as tarefas de "${dayName}"? Esta ação é irreversível e não poderá recuperar as tarefas.`,
      header: 'Eliminar Todas as Tarefas do Dia',
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
      this.messageService.add({ severity: 'info', summary: 'Info', detail: `Não há tarefas para eliminar em "${this.datePipe.transform(this.selectedDate, 'fullDate', 'pt-PT')}".` });
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

      // Apenas chama fetchTasks para re-sincronizar tudo.
      this.fetchTasks(); // ALTERADO

      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: `Todas as tarefas de "${this.datePipe.transform(this.selectedDate, 'fullDate', 'pt-PT')}" foram eliminadas!` });
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
      this.allTasks = []; // Limpa localmente
      this.currentTasks = []; // Limpa localmente

      // Apenas chama fetchTasks para re-sincronizar tudo (o que fará com que o UI volte para a semana atual por padrão).
      this.fetchTasks(); // ALTERADO

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

      // Apenas chama fetchTasks para re-sincronizar tudo.
      this.fetchTasks(); // ALTERADO

      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Tarefa eliminada!' });
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao eliminar tarefa: ${error.message}` });
      console.error("Erro ao eliminar tarefa:", error);
    }
  }

  async drop(event: CdkDragDrop<Task[]>): Promise<void> {
    // Se a tarefa foi arrastada e solta na mesma posição, não faz nada
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    // Identifica as tarefas arrastada e de destino na lista atual
    const draggedTask = this.currentTasks[event.previousIndex];
    const targetTask = this.currentTasks[event.currentIndex];

    // Verificações de segurança
    if (!draggedTask || !targetTask) {
      console.warn("Tarefa arrastada ou de destino é indefinida. Não é possível realizar a troca.");
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Erro na operação de arrastar e soltar: Tarefa inválida.' });
      return;
    }

    // Garante que ambas as tarefas têm IDs válidos para atualização na base de dados
    if (!draggedTask.id || !targetTask.id) {
      console.error("Tarefa arrastada ou de destino está sem ID. Não é possível atualizar a base de dados.");
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Erro na operação de arrastar e soltar: ID de tarefa em falta.' });
      return;
    }

    // Armazena os valores originais de data/hora para a troca
    const originalDraggedDateTime = new Date(draggedTask.dateTime.getTime());
    const originalDraggedTime = draggedTask.time;

    const originalTargetDateTime = new Date(targetTask.dateTime.getTime());
    const originalTargetTime = targetTask.time;

    // --- Realiza a troca de data e hora nos objetos em memória ---
    draggedTask.dateTime = originalTargetDateTime;
    draggedTask.time = originalTargetTime;

    targetTask.dateTime = originalDraggedDateTime;
    targetTask.time = originalDraggedTime;

    // No UI, para um feedback visual imediato antes do fetchTasks,
    // pode-se reordenar os itens, mas a ordem final será definida pelo fetchTasks.
    // moveItemInArray(this.currentTasks, event.previousIndex, event.currentIndex);

    // --- Inicia a Transação em Batch no Firestore ---
    const batch = writeBatch(this.firestore);

    // Atualiza a tarefa arrastada no Firestore com a nova data/hora
    const draggedTaskRef = doc(this.firestore, 'tasks', draggedTask.id);
    batch.update(draggedTaskRef, {
      dateTime: draggedTask.dateTime,
      time: draggedTask.time,
      // O orderIndex NÃO é atualizado aqui diretamente,
      // ele será reatribuído corretamente por fetchTasks() após re-ordenar todas as tarefas
    });

    // Atualiza a tarefa de destino no Firestore com a nova data/hora
    const targetTaskRef = doc(this.firestore, 'tasks', targetTask.id);
    batch.update(targetTaskRef, {
      dateTime: targetTask.dateTime,
      time: targetTask.time,
      // O orderIndex NÃO é atualizado aqui diretamente
    });

    try {
      await batch.commit(); // Confirma a transação em batch
      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Datas das tarefas trocadas!' });

      // Após a troca bem-sucedida e o commit, recarrega todas as tarefas.
      // Isto irá reler as tarefas da BD com as novas datas, re-ordenar allTasks
      // por dateTime e orderIndex, e depois re-filtrar currentTasks para o dia/semana selecionado(a).
      // Isso garante que o orderIndex é tratado implicitamente e a UI é totalmente consistente.
      this.fetchTasks();
    } catch (error: any) {
      console.error("Erro ao trocar datas das tarefas:", error);
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao trocar datas das tarefas: ${error.message}` });

      // --- Reverte as alterações em memória se a atualização da base de dados falhar ---
      draggedTask.dateTime = originalDraggedDateTime;
      draggedTask.time = originalDraggedTime;
      targetTask.dateTime = originalTargetDateTime;
      targetTask.time = originalTargetTime;

      // Opcional: Reverter também a posição visual se moveItemInArray tivesse sido usado antes do commit
      // moveItemInArray(this.currentTasks, event.currentIndex, event.previousIndex);
    }
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

  // --- Funções de movimento de tarefas ---
  async moveTask(task: Task, direction: 'up' | 'down'): Promise<void> {
    if (!task.id) return;

    // Determine the array index for the specific 'currentTasks' subset
    const taskCurrentIndex = this.currentTasks.findIndex(t => t.id === task.id);
    let targetIndex = -1;

    if (direction === 'up' && taskCurrentIndex > 0) {
      targetIndex = taskCurrentIndex - 1;
    } else if (direction === 'down' && taskCurrentIndex < this.currentTasks.length - 1) {
      targetIndex = taskCurrentIndex + 1;
    } else {
      return; // Can't move
    }

    const affectedTasks = [...this.currentTasks]; // Create a mutable copy
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
      // Update local array (opcional, fetchTasks vai buscar a DB)
      this.allTasks = this.allTasks.map(t => {
        const updatedTask = affectedTasks.find(at => at.id === t.id);
        return updatedTask || t;
      });

      // Apenas chama fetchTasks para re-sincronizar tudo.
      this.fetchTasks(); // ALTERADO

      this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: 'Ordem da tarefa atualizada!' });
    } catch (error: any) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao mover tarefa: ${error.message}` });
      console.error("Erro ao mover tarefa:", error);
    }
  }

  async moveTaskUp(task: Task): Promise<void> {
    await this.moveTask(task, 'up');
  }

  async moveTaskDown(task: Task): Promise<void> {
    await this.moveTask(task, 'down');
  }

  // Antigo selectDay, adaptado
  selectDay(day: string): void {
    // Este método não é mais chamado diretamente pelos botões de dia.
    // Ele será mantido para compatibilidade ou pode ser removido se não houver mais uso.
    // A nova lógica de seleção de dia é feita por selectDayByDate(date: Date).
  }

  // NOVO MÉTODO: Filtra as tarefas pela data selecionada
  filterTasksBySelectedDate(date: Date): void {
    const selectedDayStart = new Date(date);
    selectedDayStart.setHours(0, 0, 0, 0);
    const selectedDayEnd = new Date(date);
    selectedDayEnd.setHours(23, 59, 59, 999);

    this.currentTasks = this.allTasks.filter(task => {
      if (!task.dateTime) return false;
      const taskDateTime = new Date(task.dateTime);
      return taskDateTime.getTime() >= selectedDayStart.getTime() && taskDateTime.getTime() <= selectedDayEnd.getTime();
    }).sort((a, b) => {
      // Sort first by completion status (incomplete first), then by dateTime, then by orderIndex
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1; // Incomplete tasks come before completed tasks
      }
      const dateComparison = a.dateTime.getTime() - b.dateTime.getTime();
      if (dateComparison !== 0) return dateComparison;
      return a.orderIndex - b.orderIndex;
    });
    this.updateProgressBar();
  }

  setNewTaskDateTimeBasedOnSelectedDay(): void {
    // A nova tarefa é sempre definida para a data que está atualmente selecionada na linha temporal.
    // Se não houver data selecionada (por exemplo, ao carregar a página pela primeira vez),
    // definirá para a data e hora atuais.
    const now = new Date();
    // Garanta que selectedDate é um objeto Date válido antes de usá-lo
    const targetDate = (this.selectedDate instanceof Date && !isNaN(this.selectedDate.getTime())) ? this.selectedDate : now;
    
    this.newTaskDateTime = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      now.getHours(),       // Manter a hora atual
      now.getMinutes(),     // Manter os minutos atuais
      now.getSeconds(),     // Manter os segundos atuais
      now.getMilliseconds() // Manter os milissegundos atuais
    );

    // Verificação final: se a data criada for inválida por algum motivo, resetar para agora.
    if (isNaN(this.newTaskDateTime.getTime())) {
        console.warn('newTaskDateTime criado como Data Inválida, a reiniciar para agora.');
        this.newTaskDateTime = new Date();
    }
  }

    private updateSelectedWeekRangeFromTimeline(date: Date): void {
    const startOfWeekForDate = this.getStartOfWeek(date);

    // Procurar se a semana do dia clicado já está na lista de semanas disponíveis
    const correspondingOption = this.availableWeekRanges.find(
      range => this.isSameDay(range.value as Date, startOfWeekForDate)
    );

    if (correspondingOption) {
      this.selectedWeekRange = correspondingOption.value as Date; // Atribui a Date real à propriedade
    } else {
      // Se a semana não estiver na lista pré-gerada (ex: muito no futuro/passado),
      // podemos defini-la para o início da semana calculada.
      // O dropdown pode não mostrá-la se não estiver nas options, mas o valor interno estará correto.
      this.selectedWeekRange = startOfWeekForDate;

      // Opcional: Se desejar que semanas muito distantes apareçam no dropdown,
      // poderia chamar this.generateWeekRanges() aqui novamente, mas seria um
      // processo mais pesado se feito frequentemente.
    }
  }

  resetNewTaskForm(): void {
    this.newTaskTitle = '';
    this.newTaskDescription = '';
    this.newTaskPriority = 'Normal';
    this.setNewTaskDateTimeBasedOnSelectedDay(); // Reseta a data/hora para o dia selecionado
  }

  // Getter para formatar a data da nova tarefa para exibição
  get formattedNewTaskDateDisplay(): string {
    if (!this.newTaskDateTime) {
      return '';
    }
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return this.newTaskDateTime.toLocaleDateString('pt-PT', options);
  }

  // Método para remover um item do autocomplete (categoria ou tarefa comum)
  async removeAutoCompleteItem(itemToRemove: TaskOption, event: Event): Promise<void> {
    event.stopPropagation(); // Evita que o autocomplete seja selecionado

    this.confirmationService.confirm({
      message: `Tem a certeza que deseja remover "${itemToRemove.label}" das suas sugestões de tarefas?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sim',
      rejectLabel: 'Não',
      accept: async () => {
        let itemRemoved = false;
        for (const group of this.groupedTasks) {
          // Check if it's a default group and if the item is one of its original default items
          const isDefaultGroup = this.defaultGroupedTasks.some(defaultGroup => defaultGroup.value === group.value);
          const originalDefaultGroup = this.defaultGroupedTasks.find(dg => dg.value === group.value);
          const isOriginalDefaultItem = originalDefaultGroup && originalDefaultGroup.items.some(item => item.value.toLowerCase() === itemToRemove.value.toLowerCase());

          if (isDefaultGroup && isOriginalDefaultItem) {
              this.messageService.add({severity: 'warn', summary: 'Aviso', detail: `Não pode remover itens padrão de categorias padrão.`});
              return;
          }

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

  // NOVO MÉTODO: Confirma a eliminação de todas as categorias
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

  // NOVO MÉTODO: Elimina todas as categorias do utilizador (a coleção 'userCategories')
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

  // NOVO MÉTODO: Confirma a eliminação de uma categoria selecionada
  confirmDeleteSelectedCategory(): void {
    if (!this.selectedCategoryToDelete) {
      this.messageService.add({ severity: 'warn', summary: 'Atenção', detail: 'Por favor, selecione uma categoria para eliminar.' });
      return;
    }

    const categoryLabel = (this.selectedCategoryToDelete.value as TaskGroup).label;

    this.confirmationService.confirm({
      message: `Tem a certeza que deseja eliminar a categoria "${categoryLabel}" e todos os seus itens? Esta ação não pode ser desfeita. As tarefas existentes com esta categoria NÃO serão eliminadas, apenas a associação da categoria.`,
      header: 'Eliminar Categoria Selecionada',
      icon: 'pi pi-exclamation-triangle',
      acceptIcon: 'pi pi-times',
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
        this.deleteSelectedCategory();
      },
      reject: () => {
        this.messageService.add({ severity: 'info', summary: 'Cancelado', detail: `A eliminação da categoria "${categoryLabel}" foi cancelada.` });
      }
    });
  }

  // NOVO MÉTODO: Elimina a categoria selecionada e seus itens
  async deleteSelectedCategory(): Promise<void> {
    if (!this.userId || !this.selectedCategoryToDelete) {
      this.messageService.add({ severity: 'error', summary: 'Erro', detail: 'Selecione uma categoria válida e esteja autenticado.' });
      return;
    }

    const categoryValueToDelete = (this.selectedCategoryToDelete.value as TaskGroup).value;

    // Filter out the selected category group
    const initialGroupedTasksLength = this.groupedTasks.length;
    this.groupedTasks = this.groupedTasks.filter(group => group.value !== categoryValueToDelete);

    if (this.groupedTasks.length < initialGroupedTasksLength) {
        try {
            await this.saveUserCategories(); // Salve the modified categories
            this.updateAvailableCategories(); // Refresh dropdowns
            this.messageService.add({ severity: 'success', summary: 'Sucesso', detail: `Categoria "${this.selectedCategoryToDelete.label}" eliminada!` });
            this.selectedCategoryToDelete = null; // Clear selection
            // Optionally, update tasks that had this category to null or 'Sem Categoria'
            // This would require iterating through allTasks and updating them in Firestore.
            // For now, we'll just remove the category from the categories list.
            this.allTasks.forEach(task => {
                if (task.category === (this.selectedCategoryToDelete?.value as TaskGroup)?.label) {
                    task.category = null; // Set to null or a default 'No Category'
                    // Consider updating this in Firestore as well if this is a requirement
                }
            });
            this.filterTasksBySelectedDate(this.selectedDate); // Re-render tasks to reflect potential category changes
            this.generateWeekDays(); // Atualiza os badges
        } catch (error: any) {
            this.messageService.add({ severity: 'error', summary: 'Erro', detail: `Falha ao eliminar categoria: ${error.message}` });
            console.error("Erro ao eliminar categoria selecionada:", error);
        }
    } else {
        this.messageService.add({ severity: 'warn', summary: 'Atenção', detail: 'A categoria selecionada não foi encontrada ou não pôde ser eliminada.' });
    }
  }

  // NOVO: Getter para verificar se apenas as categorias padrão estão presentes
  get areOnlyDefaultCategoriesPresent(): boolean {
    // Primeiro, verifique se os comprimentos são diferentes, indicando que há categorias personalizadas.
    if (this.groupedTasks.length !== this.defaultGroupedTasks.length) {
      return false;
    }

    // Se os comprimentos são iguais, compare cada grupo.
    // Certifique-se de que cada grupo em groupedTasks é um defaultGroup
    // e que a contagem de itens em cada grupo seja a mesma que nos defaultGroups
    return this.groupedTasks.every(groupedTask => {
      const defaultGroup = this.defaultGroupedTasks.find(defaultG => defaultG.value === groupedTask.value);

      // Se não encontrar um grupo padrão correspondente, significa que há um grupo personalizado
      if (!defaultGroup) {
        return false;
      }

      // Se encontrar o grupo padrão, verifique se a contagem de itens é a mesma
      // Isso é para garantir que nenhum item personalizado foi adicionado a um grupo padrão
      if (groupedTask.items.length !== defaultGroup.items.length) {
        return false;
      }

      // Finalmente, verifique se todos os itens no grupo atual (do usuário)
      // estão presentes no grupo padrão correspondente.
      return groupedTask.items.every(item =>
        defaultGroup.items.some(defaultItem => defaultItem.value === item.value)
      );
    });
  }

  // Método para atualizar a barra de progresso
  updateProgressBar(): void {
    if (this.currentTasks.length === 0) {
      this.progressSubject.next(0);
      return;
    }
    const completedTasks = this.currentTasks.filter(task => task.completed).length;
    const progress = (completedTasks / this.currentTasks.length) * 100;
    this.progressSubject.next(Math.round(progress));
  }
}

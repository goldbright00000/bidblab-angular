import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { CommonService } from '../../shared/services/common.service';
import { MatSnackBar } from '@angular/material';
import { DialogService } from '../../shared/services/dialog.service';
import { AuthenticationService } from '../../shared/services/authentication.service';
import { BlockUIService } from '../../shared/services/block-ui.service';
import { Question } from '../../shared/models/question.model';
import { QuestionDialogComponent } from '../../shared/components/question-dialog/question-dialog.component';
import { LoginComponent } from '../../shared/components/login/login.component';
import { FormBuilder, FormGroup } from '@angular/forms';
import { debounceTime, filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { AnswerDialogComponent } from '../../shared/components/answer-dialog/answer-dialog.component';
import { Answer } from '../../shared/models/answer.model';
import { SocketsService } from '../../shared/services/sockets.service';
import { AlertDialogComponent } from '../../shared/components/alert-dialog/alert-dialog.component';

@Component({
  selector: 'app-blab',
  templateUrl: './blab.component.html',
  styleUrls: ['./blab.component.scss']
})
export class BlabComponent implements OnInit, OnDestroy {
  form: FormGroup;
  questions: Question[] = [];
  totalQuestionsCount: number;
  autocomplete: Question[];
  private autocompleteSubscription: Subscription;
  private socketEventsSubscription: Subscription;
  private pageSize: number = 10;
  pageIndex: number = 0;
  isInit: boolean;
  newQuestionFlag: boolean;
  defaultCredits: any;
  
 
  constructor(
    private fb: FormBuilder,
    private socketsService: SocketsService,
    private blockUIService: BlockUIService,
    public commonService: CommonService,
    private snackBar: MatSnackBar,
    private authenticationService: AuthenticationService,
    private dialogService: DialogService,
    private router: Router
  ) {}

  ngOnInit() {
    this.newQuestionFlag = false;
    this.isInit = false;
    this.form = this.fb.group({
      search: ''
    });
    this.isInit = true;
    this.autocomplete = [];
    this.form = this.fb.group({
      search: ''
    });

		this.commonService.getDefaultCredits().subscribe(
			(res: any) => {
					this.defaultCredits = res.data;
				},
			(err: HttpErrorResponse) => {
				}
      );
    this.autocompleteSubscription = this.form
      .get('search')
      .valueChanges.pipe(debounceTime(100))
      .subscribe(text => {
        if (text.trim()) {
          this.commonService
            .getQuestions(null, null, text)
            .subscribe((res: any) => {
              this.autocomplete = res.data.questions;
              if(!this.autocomplete.length){
                this.newQuestionFlag = true;
              }
              else{
                this.newQuestionFlag = false;
              }
            });
        } else {
          this.autocomplete.splice(0);
          this.newQuestionFlag = false;
        }
      });
    this.getQuestions();
    this.listenToSocket();   
  }

  ngOnDestroy() {
    if(this.isInit){
      this.autocompleteSubscription.unsubscribe();
      this.socketEventsSubscription.unsubscribe();
    }
  }

  searchBoxAction(){
    if(this.newQuestionFlag){
      this.newQuestionFlag = false;
      this.openQuestionDialog(this.form.value.search);
    }
    else{
      this.pageIndex = 0;
      this.questions = [];
      this.getQuestions();
    }
  }

  openQuestionDialog(newTitle?: String, question?: Question) {
    if (this.authenticationService.isAuthenticated()) {
      this.dialogService
        .open(QuestionDialogComponent, {
          data: {
            question,
            newTitle,
          },
          width: '800px'
        })
        .afterClosed()
        .subscribe(newQuestion => {
          if (newQuestion) {
            this.dialogService.
                open(AlertDialogComponent, {
                  data: {
                    title: "Question submitted",
                    comment: " ",
                    dialog_type: "ask" 
                  },
                  width: '320px',
                }).afterClosed().subscribe(result => {
                  if(result == 'more'){
                    this.openQuestionDialog();
                  }
                });
          }
        });
    } else {
      this.dialogService.open(LoginComponent);
    }
  }

  openAnswerDialog(questionId, answer?: Answer) {
    if (this.authenticationService.isAuthenticated()) {
      this.dialogService
        .open(AnswerDialogComponent, {
          data: {
            questionId,
            answer
          }
        })
        .afterClosed()
        .subscribe(newAnswer => {
          if (newAnswer) {
            let index = this.questions.findIndex(
              question => question._id === questionId
            );
            if (index !== -1) {
              const question = this.questions[index];
              if (answer) {
                index = question.answers.findIndex(
                  currentAnswer => currentAnswer._id === answer._id
                );
                if (index !== -1) {
                  question.answers[index] = newAnswer;
                }
              } else {
                question.answers.push(newAnswer);
              }
            }
          }
        });
    } 
    else {
      this.dialogService.open(LoginComponent);
    }
  }

  getQuestions() {
    this.autocomplete.splice(0);
    if (this.authenticationService.isAuthenticated()) {
      this.commonService.getQuestionsCanAnswer(
        null,
        null,
        this.form.value.search
      ).subscribe(
        (res: any) => {
          this.totalQuestionsCount = res.data.count;
          res.data.questions.forEach(element => {
            this.questions.push(element);
          });
        },
        (err: HttpErrorResponse) => {
        }
      );
    }
    else {
      this.commonService.getQuestions(
        null,
        null,
        this.form.value.search
      ).subscribe(
        (res: any) => {
          this.totalQuestionsCount = res.data.count;
          res.data.questions.forEach(element => {
            this.questions.push(element);
          });
        },
        (err: HttpErrorResponse) => {
        }
      );
    }
  }

  isAsker(questionId) {
    const question = this.questions.find(
      currentQuestion => currentQuestion._id === questionId
    );
    return (
      this.authenticationService.getUser() &&
      question.asker &&
      question.asker._id === this.authenticationService.getUser()._id
    );
  }

  isAdmin() {
    return this.authenticationService.isAdmin();
  }

  canAnswer(questionId) {
    return (
      !this.authenticationService.getUser() ||
      !this.questions
        .find(question => question._id === questionId)
        .answers.some(
          answer =>
            answer.answerer &&
            answer.answerer._id === this.authenticationService.getUser()._id
        )
    );
  }

  private listenToSocket() {
    this.socketEventsSubscription = this.socketsService
      .getSocketEvents()
      .pipe(filter((event: any) => event.payload))
      .subscribe((event: any) => {
        this.snackBar.open('Questions were updated.', 'Dismiss', {
          duration: 2000
        });
        if (event.payload.type === 'question') {
          if (event.name === 'createdData') {
            this.totalQuestionsCount++;
            if (this.questions.length < this.pageSize) {
              this.questions.push(event.payload.data);
            }
          } else {
            const index = this.questions.findIndex(
              currentQuestion => currentQuestion._id === event.payload.data._id
            );
            if (index !== -1) {
              if (event.name === 'updatedData') {
                this.questions[index] = event.payload.data;
              } else {
                this.questions.splice(index, 1);
                this.totalQuestionsCount--;
              }
            }
          }
        } else {
          let index = this.questions.findIndex(
            currentQuestion =>
              currentQuestion._id === event.payload.data.questionId
          );
          if (index !== -1) {
            const question = this.questions[index];
            if (event.name === 'createdData') {
              question.answers.push(event.payload.data);
            } else {
              index = question.answers.findIndex(
                currentAnswer => currentAnswer._id === event.payload.data._id
              );
              if (index !== -1) {
                if (event.name === 'updatedData') {
                  question.answers[index] = event.payload.data;
                } else {
                  question.answers.splice(index, 1);
                }
              }
            }
          }
        }
      });
  }

  async deleteQuestion(questionId) {
    try {
      const res = (await this.commonService.deleteQuestion(questionId)) as any;
      this.socketsService.notify('deletedData', {
        type: 'question',
        data: res.data
      });
      this.snackBar.open(res.msg, 'Dismiss', {
        duration: 1500
      });
      const index = this.questions.findIndex(
        currentQuestion => currentQuestion._id === questionId
      );
      if (index !== -1) {
        this.questions.splice(index, 1);
      }
    } catch (err) {
      this.snackBar.open(err.error.msg, 'Dismiss');
    }
  }

  onScroll() {  
    if((this.pageIndex + 1) * this.pageSize < this.totalQuestionsCount){
      this.pageIndex = this.pageIndex + 1;
      this.getQuestions();
    } 
  } 

}


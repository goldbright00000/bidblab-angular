import { Component, OnInit, Input } from '@angular/core';
import { Auction, Bid } from '../../../../shared/models/auction.model';
import { MatSnackBar } from '@angular/material';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonService } from '../../../../shared/services/common.service';
import { SocketsService } from '../../../../shared/services/sockets.service';
import { BlockUIService } from '../../../../shared/services/block-ui.service';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthenticationService } from '../../../../shared/services/authentication.service';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { DialogService } from '../../../../shared/services/dialog.service';
import { AlertDialogComponent } from '../../../../shared/components/alert-dialog/alert-dialog.component';
import { environment } from '../../../../../environments/environment';
import { BidService } from '../bid.service';
import { AuctionDialogComponent } from '../auction-dialog/auction-dialog.component';
import { MatDialog } from '@angular/material';

@Component({
  selector: 'app-auction-result',
  templateUrl: './auction-result.component.html',
  styleUrls: ['./auction-result.component.scss']
})
export class AuctionResultComponent implements OnInit {

  @Input() auction: any;
  @Input() auctionType: any;
  private serverUrl = environment.apiUrl;

  constructor(
    private bidService: BidService,
		public dialog: MatDialog,
  ) {
  }

  ngOnInit() {
  }

  openBidDialog(){
    if(this.bidService.availuableCredits < this.auction.bidFee){
      this.dialog.open(AlertDialogComponent, 
        {
          data: {
            title: "You need more BidBlab Credits to continue bidding!",
            comment: "You can earn more BibBlab Credits by submitting and answering questions",
            dialog_type: "alert" 
          },
          width: '320px',
        });
    }
    else{
      this.dialog
        .open(AuctionDialogComponent, {
          data: {
            auction: this.auction
          },
          width: '800px'
        })
        .afterClosed()
        .subscribe(newBid => {
          if (newBid) {
            this.dialog.
              open(AlertDialogComponent, {
                data: {
                  title: "Bid successfully submitted!",
                  comment: "",
                  dialog_type: "bid" 
                },
                width: '320px',
              }).afterClosed().subscribe(result => {
                if(result == 'more'){
                  this.openBidDialog();
                }
              });
          }
        });
    }
  }

  displayDetail(){
    this.bidService.detailAuction = this.auction;
    this.bidService.detailAuction.display = true;
  }
  
}



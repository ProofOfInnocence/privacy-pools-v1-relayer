import { Body, Controller, Get, HttpStatus, Param, Post, Res } from '@nestjs/common';
import { Response } from 'express';

import { ApiService } from './api.service';
import { validateTransactionRequest } from './api.validator';

@Controller()
export class ApiController {
  constructor(private readonly service: ApiService) {}

  @Get('/status')
  async status(@Res() res: Response): Promise<Response<Status>> {
    return res.json(await this.service.status());
  }

  @Get('/')
  root(@Res() res: Response): Response<string> {
    return res.send(this.service.root());
  }

  @Get('/job/:jobId')
  async getJob(@Res() res: Response, @Param('jobId') jobId: string) {
    const job = await this.service.getJob(jobId);

    if (!job) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: "The job doesn't exist" });
    }
    return res.json(job);
  }

  @Post('/transaction')
  async transaction(@Res() res: Response, @Body() body: any) {
    console.log('this is body: ', body);
    // const { params } = JSON.parse(body);
    const inputError = validateTransactionRequest(body);

    if (inputError) {
      console.log('Invalid input:', inputError);
      return res.status(HttpStatus.BAD_REQUEST).json({ error: inputError });
    }

    const jobId = await this.service.transaction(body);

    return res.send(jobId);
  }
}

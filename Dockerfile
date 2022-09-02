FROM public.ecr.aws/lambda/nodejs:16
COPY app.js package.json  ${LAMBDA_TASK_ROOT}/
RUN npm i
COPY . .
CMD [ "app.handler" ]  